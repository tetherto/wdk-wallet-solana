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

import * as bip39 from 'bip39'
import HDKey, { HARDENED_OFFSET } from 'micro-key-producer/slip10.js'
import { getAddressDecoder } from '@solana/addresses'

// eslint-disable-next-line camelcase
import { sodium_memzero } from 'sodium-universal'

import * as curve from '@noble/ed25519'

import { DisposalError, ValueError } from '@tetherto/wdk-wallet'

import { assertFullHardenedPath, signMessage, signTransactionBytes } from './signer-solana.js'

/**
 * @typedef {import("./signer-solana.js").ISignerSolana} ISignerSolana
 */

/** @typedef {import('@tetherto/wdk-wallet').KeyPair} KeyPair */
/** @typedef {import('micro-key-producer/slip10.js').HDKey} HDKey */

/** @internal */
export const BIP_44_SOL_DERIVATION_PATH_PREFIX = "m/44'/501'"

/**
 * Securely erases an HD node's private key and chain code from memory.
 *
 * @param {HDKey} node - The HD node.
 */
function scrub (node) {
  sodium_memzero(node.privateKey)
  sodium_memzero(node.chainCode)
}

/**
 * Derives an HD node along the given path segments, erasing every node it leaves behind,
 * including the starting one, so that only the returned node holds key material. A node is
 * erased even when deriving its child throws, so a failed derivation leaves no key material behind.
 *
 * @param {HDKey} node - The starting HD node.
 * @param {string[]} segments - The path segments to derive.
 * @returns {HDKey} The HD node at the end of the path.
 * @throws {Error} If a segment's index is out of range (2^31 or greater).
 */
function deriveAndScrub (node, segments) {
  for (const segment of segments) {
    let child

    try {
      child = node.deriveChild(HARDENED_OFFSET + parseInt(segment, 10))
    } finally {
      scrub(node)
    }

    node = child
  }

  return node
}

/**
 * Signer implementation that derives keys from a BIP-39 seed using a SLIP-0010 path.
 *
 * Every signer holds exactly one HD node and owns an independent copy of its key, so disposing
 * one never affects its parent, children or siblings. Intermediate nodes built while deriving
 * (including the master node) are erased as soon as they are no longer needed.
 *
 * @implements {ISignerSolana}
 */
export default class SeedSignerSolana {
  /**
   * Creates a new seed signer.
   *
   * @param {string | Uint8Array} seed - A [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) mnemonic seed phrase, or a raw BIP-32 master seed (16-64 bytes).
   * @param {string} [path] - An absolute SLIP-0010 path; every segment must be hardened (default: "m/44'/501'").
   * @throws {ValueError} If the seed phrase is invalid, if the seed is not between 16 and 64 bytes, or if the path is not absolute, not a valid BIP-32 path or not fully hardened.
   */
  constructor (seed, path = BIP_44_SOL_DERIVATION_PATH_PREFIX) {
    const ownsSeed = typeof seed === 'string'

    if (ownsSeed) {
      if (!bip39.validateMnemonic(seed)) {
        throw new ValueError('The seed phrase is invalid.')
      }
      seed = bip39.mnemonicToSeedSync(seed)
    }

    let master

    try {
      assertFullHardenedPath(path, { requireAbsolute: true })

      try {
        master = HDKey.fromMasterSeed(seed)
      } catch (error) {
        throw new ValueError('The seed must be between 16 and 64 bytes.', { cause: error })
      }
    } finally {
      if (ownsSeed) {
        sodium_memzero(seed)
      }
    }

    const node = path === 'm' ? master : deriveAndScrub(master, path.slice(2).split('/'))

    this._init(path, node)
  }

  /** @private */
  _init (path, node) {
    /** @private */
    this._node = node

    /** @private */
    this._path = path

    /** @private */
    this._rawPrivateKey = node.privateKey

    /** @private */
    this._rawPublicKey = curve.getPublicKey(node.privateKey)

    /** @private */
    this._address = getAddressDecoder().decode(this._rawPublicKey)

    /** @private */
    this._disposed = false
  }

  /**
   * Whether this signer can derive child signers.
   *
   * @type {true}
   */
  get isDerivable () {
    return true
  }

  /**
   * The signer's absolute derivation path.
   *
   * @type {string}
   */
  get path () {
    return this._path
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
   * Returns the raw key pair bytes in standard Solana format.
   * - privateKey: 32-byte Ed25519 secret key (Uint8Array), or null once disposed
   * - publicKey: 32-byte Ed25519 public key (Uint8Array)
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
   * Derives a child signer relative to this signer's own path (e.g. calling derive("0'/0'") on
   * a signer at "m/44'/501'" yields a child at "m/44'/501'/0'/0'").
   *
   * @param {string} relPath - The path segment to derive, relative to this signer's own path.
   * @returns {Promise<SeedSignerSolana>} The derived child signer.
   * @throws {ValueError} If the path is absolute, not a valid BIP-32 path or not fully hardened.
   * @throws {DisposalError} If the signer has been disposed.
   */
  async derive (relPath) {
    if (this._disposed) {
      throw new DisposalError('The signer has been disposed.')
    }

    if (relPath === 'm' || relPath.startsWith('m/')) {
      throw new ValueError('The derivation path must be relative (e.g. "0\'/0\'").')
    }

    assertFullHardenedPath(relPath)

    const [first, ...rest] = relPath.split('/')
    const node = deriveAndScrub(this._node.deriveChild(HARDENED_OFFSET + parseInt(first, 10)), rest)

    const signer = Object.create(SeedSignerSolana.prototype)
    signer._init(`${this._path}/${relPath}`, node)

    return signer
  }

  /**
   * Returns the account's derived address.
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

    return signTransactionBytes(this._rawPrivateKey, unsignedTx)
  }

  /**
   * Disposes the signer, securely erasing its private key and chain code from memory.
   */
  dispose () {
    if (this._node) {
      scrub(this._node)
    }

    this._rawPrivateKey = undefined
    this._node = undefined
    this._disposed = true
  }
}
