// Copyright 2024 Tether Operations Limited
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use strict'

import { getAddressDecoder } from '@solana/addresses'
import { getBase58Encoder } from '@solana/codecs'

// eslint-disable-next-line camelcase
import { sodium_memcmp, sodium_memzero } from 'sodium-universal'

import * as curve from '@noble/ed25519'

import { DisposalError, UnsupportedOperationError, ValueError } from '@tetherto/wdk-wallet'

import { signMessage, signTransactionBytes } from './utils.js'

/** @typedef {import('./signer-solana.js').ISignerSolana} ISignerSolana */
/** @typedef {import('@tetherto/wdk-wallet').KeyPair} KeyPair */

const HEX_PRIVATE_KEY_PATTERN = /^[0-9a-fA-F]{64}$/

const BASE58_PATTERN = /^[1-9A-HJ-NP-Za-km-z]+$/

const INVALID_PRIVATE_KEY_MESSAGE = 'The private key must be a 32-byte key (hex or bytes) or a 64-byte secret key (base58 or bytes).'

/**
 * Decodes a private key string into bytes owned by the caller of this function.
 *
 * @param {string} privateKey - A 64-character hex key, or a base58 64-byte secret key.
 * @returns {Uint8Array} The decoded bytes (32 or 64).
 * @throws {ValueError} If the string is neither format.
 */
function decodePrivateKeyString (privateKey) {
  if (HEX_PRIVATE_KEY_PATTERN.test(privateKey)) {
    const decoded = Buffer.from(privateKey, 'hex')
    const bytes = Uint8Array.from(decoded)
    sodium_memzero(decoded)

    return bytes
  }

  if (BASE58_PATTERN.test(privateKey)) {
    const bytes = getBase58Encoder().encode(privateKey)

    if (bytes.length === 64) {
      return bytes
    }

    sodium_memzero(bytes)
  }

  throw new ValueError(INVALID_PRIVATE_KEY_MESSAGE)
}

/**
 * Copies the 32-byte Ed25519 private key out of a raw key or a 64-byte secret key
 * (private key followed by its public key).
 *
 * @param {Uint8Array} bytes - The raw key (32 bytes) or secret key (64 bytes).
 * @returns {Uint8Array} A new 32-byte private key.
 * @throws {ValueError} If the length is wrong, or if a secret key's public half does not match its private half.
 */
function copyPrivateKey (bytes) {
  if (bytes.length === 32) {
    return Uint8Array.from(bytes)
  }

  if (bytes.length !== 64) {
    throw new ValueError(INVALID_PRIVATE_KEY_MESSAGE)
  }

  const privateKey = Uint8Array.from(bytes.subarray(0, 32))

  if (!sodium_memcmp(curve.getPublicKey(privateKey), bytes.subarray(32))) {
    sodium_memzero(privateKey)
    throw new ValueError('The secret key\'s public key does not match its private key.')
  }

  return privateKey
}

/**
 * Signer backed by a single raw Ed25519 private key (non-HD).
 *
 * Does not support HD derivation. Signs messages and transactions directly with the key.
 *
 * @implements {ISignerSolana}
 */
export default class PrivateKeySignerSolana {
  /**
   * Creates a new private key signer.
   *
   * Accepts a 32-byte Ed25519 private key (as a hex string or bytes), or a 64-byte Solana secret key,
   * the private key followed by its public key, as exported by `solana-keygen` and wallets (as a base58
   * string or bytes).
   *
   * The supplied key is copied: the signer keeps its own internal copy alive until {@link dispose}
   * zeroes it, and never wipes the supplied key, whose disposal remains the caller's responsibility.
   *
   * @param {string | Uint8Array} privateKey - The private key or secret key.
   * @throws {ValueError} If the key is in neither format, or if a secret key's public half does not match its private half.
   */
  constructor (privateKey) {
    let key

    if (typeof privateKey === 'string') {
      const decoded = decodePrivateKeyString(privateKey)
      key = copyPrivateKey(decoded)
      sodium_memzero(decoded)
    } else {
      key = copyPrivateKey(privateKey)
    }

    /**
     * Raw Ed25519 private key bytes (32 bytes), owned by the signer.
     *
     * @private
     * @type {Uint8Array | undefined}
     */
    this._rawPrivateKey = key

    /**
     * Raw Ed25519 public key bytes (32 bytes).
     *
     * @private
     * @type {Uint8Array}
     */
    this._rawPublicKey = curve.getPublicKey(key)

    /** @private */
    this._address = getAddressDecoder().decode(this._rawPublicKey)

    /** @private */
    this._disposed = false
  }

  /**
   * Whether this signer can derive child signers.
   *
   * @type {false}
   */
  get isDerivable () {
    return false
  }

  /**
   * The derivation path. Always null for private-key signers.
   *
   * @type {null}
   */
  get path () {
    return null
  }

  /**
   * True if the signer has been disposed.
   *
   * @type {boolean}
   */
  get disposed () {
    return this._disposed
  }

  /**
   * The account's key pair.
   *
   * @type {KeyPair}
   */
  get keyPair () {
    return {
      privateKey: this._rawPrivateKey ?? null,
      publicKey: this._rawPublicKey
    }
  }

  /**
   * Derives a child signer using a relative path.
   *
   * @param {string} path - The relative derivation path.
   * @returns {Promise<never>} The derived signer.
   * @throws {UnsupportedOperationError} If the signer does not support account derivation.
   */
  async derive (path) {
    throw new UnsupportedOperationError('derive(path)')
  }

  /**
   * Returns the account's address.
   *
   * @returns {Promise<string>} The account's address.
   */
  async getAddress () {
    return this._address
  }

  /**
   * Signs a message.
   *
   * @param {string} message - The message to sign.
   * @returns {Promise<string>} The message's signature.
   * @throws {DisposalError} If the signer has been disposed.
   */
  async sign (message) {
    if (this._disposed) {
      throw new DisposalError('The signer has been disposed.')
    }

    return signMessage(this._rawPrivateKey, message)
  }

  /**
   * Signs a transaction, keeping any signatures it already carries.
   *
   * @param {Uint8Array} unsignedTx - The wire-encoded transaction.
   * @returns {Promise<Uint8Array>} The wire-encoded transaction with this signer's signature added.
   * @throws {DisposalError} If the signer has been disposed.
   */
  async signTransaction (unsignedTx) {
    if (this._disposed) {
      throw new DisposalError('The signer has been disposed.')
    }

    return signTransactionBytes(this._rawPrivateKey, this._address, unsignedTx)
  }

  /**
   * Disposes the signer, securely erasing its internal copy of the private key from memory.
   */
  dispose () {
    if (this._rawPrivateKey) {
      sodium_memzero(this._rawPrivateKey)
    }

    this._rawPrivateKey = undefined
    this._disposed = true
  }
}
