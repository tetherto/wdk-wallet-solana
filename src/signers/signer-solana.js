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
import { getUtf8Encoder } from '@solana/codecs'

import * as curve from '@noble/ed25519'
import { sha512 } from '@noble/hashes/sha2.js'

import { ISigner, InvalidSignerError, NotImplementedError, ValueError } from '@tetherto/wdk-wallet'

/** @typedef {import('@tetherto/wdk-wallet').DisposalError} DisposalError */
/** @typedef {import('@tetherto/wdk-wallet').UnsupportedOperationError} UnsupportedOperationError */

// To enable @noble's synchronous methods
curve.hashes.sha512 = sha512

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
  const { requireAbsolute = false } = options

  const isAbsolute = path === 'm' || path.startsWith('m/')

  if (requireAbsolute && !isAbsolute) {
    throw new ValueError('The derivation path must be absolute (e.g. "m/44\'/501\'").')
  }

  if (path === 'm') {
    return
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
 * @param {Uint8Array} unsignedTx - The wire-encoded transaction.
 * @returns {Uint8Array} The wire-encoded transaction with the key's signature added.
 * @throws {InvalidSignerError} If the key's address is not one of the transaction's signers.
 */
export function signTransactionBytes (privateKey, unsignedTx) {
  const address = getAddressDecoder().decode(curve.getPublicKey(privateKey))
  const transaction = getTransactionDecoder().decode(unsignedTx)

  if (transaction.signatures[address] === undefined) {
    throw new InvalidSignerError('The signer is not one of the transaction\'s signers.')
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
   * @param {Uint8Array} unsignedTx - The wire-encoded transaction.
   * @returns {Promise<Uint8Array>} The wire-encoded transaction with this signer's signature added.
   * @throws {InvalidSignerError} If the signer is not one of the transaction's signers.
   * @throws {DisposalError} If the signer has been disposed.
   */
  async signTransaction (unsignedTx) {
    throw new NotImplementedError('signTransaction(unsignedTx)')
  }
}
