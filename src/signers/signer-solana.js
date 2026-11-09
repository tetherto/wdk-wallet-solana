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

import { getTransactionDecoder, getTransactionEncoder } from '@solana/transactions'
import { getAddressDecoder } from '@solana/addresses'
import { assertValidBaseString, getBase58Encoder, getUtf8Encoder } from '@solana/codecs'

import * as curve from '@noble/ed25519'
import { sha512 } from '@noble/hashes/sha2.js'

import { ISigner, NotImplementedError, ValueError } from '@tetherto/wdk-wallet'

/** @typedef {import('@tetherto/wdk-wallet').DisposalError} DisposalError */
/** @typedef {import('@tetherto/wdk-wallet').UnsupportedOperationError} UnsupportedOperationError */

// To enable @noble's synchronous methods
curve.hashes.sha512 = sha512

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

const INVALID_TRANSACTION_MESSAGE = 'The transaction must be wire-encoded bytes or a base58 string.'

/**
 * Asserts that every child path in the derivation path is hardened.
 *
 * @internal
 * @param {string} path - The derivation path, absolute ("m" or "m/...") or relative.
 * @param {Object} [options] - The assertion's options.
 * @param {boolean} [options.requireAbsolute] - If true, the path must also be absolute (default: false).
 * @throws {ValueError} If the path is required to be absolute and is not, if it is not a valid BIP-32 path, or if any child path is not hardened.
 */
export function assertFullHardenedPath (path, options = {}) {
  if (path === 'm') {
    return
  }

  const { requireAbsolute = false } = options

  const isAbsolute = path.startsWith('m/')

  if (requireAbsolute && !isAbsolute) {
    throw new ValueError('The derivation path must be absolute (e.g. "m/44\'/501\'").')
  }

  const segments = (isAbsolute ? path.slice(2) : path).split('/')

  if (!segments.every((segment) => /^\d+'?$/.test(segment))) {
    throw new ValueError('The derivation path is not a valid BIP-32 path.')
  }

  if (!segments.every((segment) => segment.endsWith("'"))) {
    throw new ValueError('In Solana, every child path in a derivation path must be hardened.')
  }
}

/**
 * Signs a message with a raw Ed25519 private key.
 *
 * The key is used in place: no `CryptoKey`, PKCS#8 or JWK copy of it is ever created.
 *
 * @internal
 * @param {Uint8Array} privateKey - The raw Ed25519 private key (32 bytes).
 * @param {string} message - The message to sign.
 * @returns {string} The message's signature, as a hex string.
 */
export function signMessage (privateKey, message) {
  return Buffer.from(curve.sign(getUtf8Encoder().encode(message), privateKey)).toString('hex')
}

/**
 * Adds a raw Ed25519 private key's signature to a wire-encoded transaction, keeping the
 * signatures it already carries.
 *
 * @internal
 * @param {Uint8Array} privateKey - The raw Ed25519 private key (32 bytes).
 * @param {string | Uint8Array} unsignedTx - The wire-encoded transaction, as bytes or a base58 string.
 * @returns {Uint8Array} The wire-encoded transaction with the key's signature added.
 * @throws {ValueError} If the transaction is a string that is not base58, or if it doesn't include the key's address among its signatures.
 */
export function signTransactionBytes (privateKey, unsignedTx) {
  if (typeof unsignedTx === 'string') {
    try {
      assertValidBaseString(BASE58_ALPHABET, unsignedTx)
    } catch (error) {
      throw new ValueError(INVALID_TRANSACTION_MESSAGE, { cause: error })
    }
  }

  const bytes = typeof unsignedTx === 'string' ? getBase58Encoder().encode(unsignedTx) : unsignedTx
  const address = getAddressDecoder().decode(curve.getPublicKey(privateKey))
  const transaction = getTransactionDecoder().decode(bytes)

  if (transaction.signatures[address] === undefined) {
    throw new ValueError('The transaction does not include this signer among its signatures.')
  }

  const signedTransaction = {
    ...transaction,
    signatures: {
      ...transaction.signatures,
      [address]: curve.sign(transaction.messageBytes, privateKey)
    }
  }

  return Uint8Array.from(getTransactionEncoder().encode(signedTransaction))
}

/**
 * Interface for Solana signers, extending the base `ISigner` from `@tetherto/wdk-wallet`.
 *
 * @interface
 */
export class ISignerSolana extends ISigner {
  /**
   * Derive a child signer using a relative path (e.g., "0'/0'").
   *
   * @param {string} path - The relative derivation path.
   * @returns {Promise<ISignerSolana>} The derived signer.
   * @throws {UnsupportedOperationError} If the signer does not support account derivation.
   * @throws {ValueError} If the path is not valid.
   * @throws {DisposalError} If the signer has been disposed.
   */
  async derive (path) {
    throw new NotImplementedError('derive(path)')
  }

  /**
   * Signs a transaction, keeping any signatures it already carries.
   *
   * @param {string | Uint8Array} unsignedTx - The wire-encoded transaction, as bytes or a base58 string.
   * @returns {Promise<Uint8Array>} The wire-encoded transaction with this signer's signature added.
   * @throws {ValueError} If the transaction is a string that is not base58, or if it doesn't include this signer among its signatures.
   * @throws {DisposalError} If the signer has been disposed.
   */
  async signTransaction (unsignedTx) {
    throw new NotImplementedError('signTransaction(unsignedTx)')
  }
}
