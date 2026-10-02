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

import { ValueError } from '@tetherto/wdk-wallet'

import { assertAbsoluteHardenedPath, assertFullHardenedPath } from './signer-solana.js'
import { signMessage, signTransactionBytes } from './utils.js'

/**
 * @typedef {import("./signer-solana.js").ISignerSolana} ISignerSolana
 */

/** @typedef {import('@tetherto/wdk-wallet').KeyPair} KeyPair */
/** @typedef {import('micro-key-producer/slip10.js').HDKey} HDKey */

const BIP_44_SOL_DERIVATION_PATH_PREFIX = "m/44'/501'"

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
 * Derives the hardened child of an HD node for one path segment (e.g. "44'").
 *
 * @param {HDKey} node - The parent HD node.
 * @param {string} segment - The path segment.
 * @returns {HDKey} The child HD node.
 */
function deriveHardenedChild (node, segment) {
  return node.deriveChild(HARDENED_OFFSET + parseInt(segment, 10))
}

/**
 * Derives an HD node along the given path segments, erasing every node it leaves behind,
 * including the starting one, so that only the returned node holds key material.
 *
 * @param {HDKey} node - The starting HD node.
 * @param {string[]} segments - The path segments to derive.
 * @returns {HDKey} The HD node at the end of the path.
 */
function deriveAndScrub (node, segments) {
  for (const segment of segments) {
    const child = deriveHardenedChild(node, segment)
    scrub(node)
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
   * @throws {ValueError} If the seed phrase is invalid, or if the path is not absolute or not fully hardened.
   */
  constructor (seed, path = BIP_44_SOL_DERIVATION_PATH_PREFIX) {
    if (typeof seed === 'string') {
      if (!bip39.validateMnemonic(seed)) {
        throw new ValueError('The seed phrase is invalid.')
      }
      seed = bip39.mnemonicToSeedSync(seed)
    }

    assertAbsoluteHardenedPath(path)

    const master = HDKey.fromMasterSeed(seed)
    const node = path === 'm' ? master : deriveAndScrub(master, path.slice(2).split('/'))

    this._init(node, path)
  }

  /**
   * Binds the signer to an HD node.
   *
   * @private
   * @param {HDKey} node - The HD node at the signer's path.
   * @param {string} path - The signer's absolute path.
   */
  _init (node, path) {
    /** @private */
    this._node = node

    /** @private */
    this._path = path

    /**
     * Raw Ed25519 private key bytes (32 bytes).
     *
     * @private
     * @type {Uint8Array | undefined}
     */
    this._rawPrivateKey = node.privateKey

    /**
     * Raw Ed25519 public key bytes (32 bytes).
     *
     * @private
     * @type {Uint8Array}
     */
    this._rawPublicKey = curve.getPublicKey(node.privateKey)

    /** @private */
    this._address = getAddressDecoder().decode(this._rawPublicKey)
  }

  /**
   * Whether this signer can derive child signers. Always true: every seed signer holds an
   * HD node and can derive below its own path.
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
   * @throws {ValueError} If the path is not fully hardened.
   */
  async derive (relPath) {
    assertFullHardenedPath(relPath)

    const [first, ...rest] = relPath.split('/')
    const node = deriveAndScrub(deriveHardenedChild(this._node, first), rest)

    const signer = Object.create(SeedSignerSolana.prototype)
    signer._init(node, `${this._path}/${relPath}`)

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
   */
  async sign (message) {
    return signMessage(this._rawPrivateKey, message)
  }

  /**
   * Signs a transaction, keeping any signatures it already carries.
   *
   * @param {Uint8Array} unsignedTx - The wire-encoded transaction.
   * @returns {Promise<Uint8Array>} The wire-encoded transaction with this signer's signature added.
   */
  async signTransaction (unsignedTx) {
    return signTransactionBytes(this._rawPrivateKey, this._address, unsignedTx)
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
  }
}
