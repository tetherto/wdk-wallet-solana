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
import HDKey from 'micro-key-producer/slip10.js'
import { verifySignature, signBytes } from '@solana/keys'
import {
  createKeyPairSignerFromPrivateKeyBytes,
  setTransactionMessageFeePayerSigner,
  signTransactionMessageWithSigners
} from '@solana/signers'
import { getBase64EncodedWireTransaction, getTransactionDecoder } from '@solana/transactions'
import {
  decompileTransactionMessage,
  getCompiledTransactionMessageDecoder
} from '@solana/transaction-messages'

// eslint-disable-next-line camelcase
import { sodium_memzero } from 'sodium-universal'

import { assertFullHardenedPath } from './signer-solana.js'

/**
 * @typedef {import("./signer-solana.js").ISignerSolana} ISignerSolana
 */

/** @typedef {import('@tetherto/wdk-wallet').KeyPair} KeyPair */
/** @typedef {import('micro-key-producer/slip10.js').HDKey} HDKey */
/** @typedef {import('@solana/signers').KeyPairSigner} KeyPairSigner */

/**
 * @typedef {Object} SeedSignerSolOpts
 * @property {HDKey} [root] The root node that can be provided alternatively to the seed.
 * @property {string} [path] The BIP-44 derivation path (e.g. "0'/0'"). Note that, All child paths must be hardened in Solana.
 */

/**
 * @typedef {Object} SeedSignerSolCfg
 */

const BIP_44_SOL_DERIVATION_PATH_PREFIX = "m/44'/501'"

/**
 * @implements {ISignerSolana}
 */
export default class SeedSignerSolana {
  /**
   * @constructor
   * @param {string} seed The seed.
   * @param {SeedSignerSolCfg} config
   * @param {SeedSignerSolOpts} opts
   */
  constructor (seed, config = {}, opts = {}) {
    if (opts.root && seed) {
      throw new Error('Provide either a seed or a root, not both.')
    }

    if (!opts.root && !seed) {
      throw new Error('Seed or root is required.')
    }

    if (typeof seed === 'string') {
      if (!bip39.validateMnemonic(seed)) {
        throw new Error('The seed phrase is invalid.')
      }
      seed = bip39.mnemonicToSeedSync(seed)
    }

    /** @private */
    this._config = config

    /** @private */
    this._isRoot = true

    /** @private */
    this._root =
      opts.root ||
      (seed ? HDKey.fromMasterSeed(seed).derive(BIP_44_SOL_DERIVATION_PATH_PREFIX) : undefined)

    /**
     * The solana keypair.
     *
     * @private
     * @type {KeyPairSigner | undefined}
     */
    this._account = undefined

    /** @private */
    this._address = undefined

    /** @private */
    this._path = undefined

    /** @private */
    this._rawPublicKey = undefined

    /** @private */
    this._rawPrivateKey = undefined

    if (opts.path) {
      assertFullHardenedPath(opts.path)

      this._path = `${BIP_44_SOL_DERIVATION_PATH_PREFIX}/${opts.path}`
      this._isRoot = false
    }
  }

  get config () {
    return this._config
  }

  get isRoot () {
    return this._isRoot
  }

  get index () {
    if (!this._path) return undefined
    return +this._path.replace(/'/g, '').split('/').at(3)
  }

  get path () {
    return this._path
  }

  /**
   * The account's key pair.
   *
   * Returns the raw key pair bytes in standard Solana format.
   * - privateKey: 32-byte Ed25519 secret key (Uint8Array)
   * - publicKey: 32-byte Ed25519 public key (Uint8Array)
   *
   * @type {KeyPair}
   */
  get keyPair () {
    return {
      privateKey: this._rawPrivateKey,
      publicKey: this._rawPublicKey
    }
  }

  /**
   * Connect to the account.
   *
   * _The function name `connect` follows the hardware signer convention. Here, `connect` means deriving a child HD key from the root node._
   *
   * @private
   * @returns {Promise<void>} Void.
   */
  async _connect () {
    const [, relPath] = this._path.split(BIP_44_SOL_DERIVATION_PATH_PREFIX)

    if (!relPath) {
      throw new Error('Not allowed to interact with the root node.')
    }
    if (!this._root) throw new Error('The root node is not provided.')

    const { privateKey } = this._root.derive(`m${relPath}`, true)

    const account = await createKeyPairSignerFromPrivateKeyBytes(privateKey)

    this._account = account
    this._address = this._account.address

    const publicKey = await crypto.subtle.exportKey('raw', account.keyPair.publicKey)

    this._rawPublicKey = new Uint8Array(publicKey)
    this._rawPrivateKey = new Uint8Array(privateKey)

    sodium_memzero(privateKey)
  }

  derive (relPath, config = {}) {
    const merged = {
      ...this._config,
      ...Object.fromEntries(Object.entries(config || {}).filter(([, v]) => v !== undefined))
    }
    return new SeedSignerSolana(null, merged, {
      root: this._root,
      path: relPath
    })
  }

  async getAddress () {
    if (!this._account) await this._connect()

    return this._address
  }

  async sign (message) {
    if (!this._account) await this._connect()

    const messageBytes = Buffer.from(message, 'utf8')
    const signatureBytes = await signBytes(this._account.keyPair.privateKey, messageBytes)

    const signature = Buffer.from(signatureBytes).toString('hex')

    return signature
  }

  async verify (message, signature) {
    if (!this._account) await this._connect()

    const messageBytes = Buffer.from(message, 'utf8')
    const signatureBytes = Buffer.from(signature, 'hex')

    const isValid = await verifySignature(
      this._account.keyPair.publicKey,
      signatureBytes,
      messageBytes
    )

    return isValid
  }

  async signTransaction (unsignedTx) {
    if (!this._account) await this._connect()

    const tx = getTransactionDecoder().decode(unsignedTx)
    const compiledTransactionMessage = getCompiledTransactionMessageDecoder().decode(
      tx.messageBytes
    )
    const readonlyTransactionMessage = decompileTransactionMessage(compiledTransactionMessage)
    const transactionMessage = setTransactionMessageFeePayerSigner(
      this._account,
      readonlyTransactionMessage
    )
    const signedTransaction = await signTransactionMessageWithSigners(transactionMessage)

    return Buffer.from(getBase64EncodedWireTransaction(signedTransaction), 'base64')
  }

  dispose () {
    sodium_memzero(this._rawPrivateKey)
    this._root = undefined
    this._account = undefined
    this._address = undefined
    this._path = undefined
  }
}
