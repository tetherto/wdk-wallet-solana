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

import {
  createKeyPairSignerFromPrivateKeyBytes,
  signTransactionMessageWithSigners,
  setTransactionMessageFeePayerSigner
} from '@solana/signers'
import { getBase64EncodedWireTransaction } from '@solana/transactions'
import { verifySignature, signBytes } from '@solana/keys'
import { setTransactionMessageLifetimeUsingBlockhash } from '@solana/transaction-messages'

import HDKey from 'micro-key-producer/slip10.js'

import * as bip39 from 'bip39'

// eslint-disable-next-line camelcase
import { sodium_memzero } from 'sodium-universal'

import WalletAccountReadOnlySolana from './wallet-account-read-only-solana.js'

/** @typedef {import("@tetherto/wdk-wallet").IWalletAccount} IWalletAccount */

/** @typedef {import('@tetherto/wdk-wallet').KeyPair} KeyPair */
/** @typedef {import('@tetherto/wdk-wallet').TransactionResult} TransactionResult */
/** @typedef {import('@tetherto/wdk-wallet').TransferOptions} TransferOptions */
/** @typedef {import('@tetherto/wdk-wallet').TransferResult} TransferResult */

/** @typedef {import('./wallet-account-read-only-solana.js').SolanaTransaction} SolanaTransaction */
/** @typedef {import('./wallet-account-read-only-solana.js').SolanaWalletConfig} SolanaWalletConfig */

const BIP_44_SOL_DERIVATION_PATH_PREFIX = "m/44'/501'"

/**
 * Full-featured Solana wallet account implementation with signing capabilities.
 *
 */
export default class WalletAccountSolana extends WalletAccountReadOnlySolana {
  /**
   * @private
   * Use {@link WalletAccountSolana.at} instead.
   */
  constructor (seed, path, config = {}) {
    if (typeof seed === 'string') {
      if (!bip39.validateMnemonic(seed)) {
        throw new Error('The seed phrase is invalid.')
      }

      seed = bip39.mnemonicToSeedSync(seed)
    }

    super(undefined, config)

    /**
     * The wallet account configuration.
     *
     * @protected
     * @type {SolanaWalletConfig}
     */
    this._config = config

    /** @private */
    this._seed = seed

    /** @private */
    this._path = `${BIP_44_SOL_DERIVATION_PATH_PREFIX}/${path}`

    /**
     * The Ed25519 key pair signer for signing transactions.
     *
     * @private
     * @type {import('@solana/keys').KeyPairSigner | undefined}
     */
    this._signer = undefined

    /**
     * Raw Ed25519 public key bytes (32 bytes).
     *
     * @private
     * @type {Uint8Array | undefined}
     */
    this._rawPublicKey = undefined

    /**
     * Raw Ed25519 private key bytes (32 bytes).
     *
     * @private
     * @type {Uint8Array | undefined}
     */
    this._rawPrivateKey = undefined
  }

  /**
   * Creates a new solana wallet account.
   *
   * @param {string | Uint8Array} seed - The wallet's [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) seed phrase.
   * @param {string} path - The BIP-44 derivation path (e.g. "0'/0/0").
   * @param {SolanaWalletConfig} [config] - The configuration object.
   * @returns {Promise<WalletAccountSolana>} The wallet account.
   */
  static async at (seed, path, config = {}) {
    const account = new WalletAccountSolana(seed, path, config)

    const hdKey = HDKey.fromMasterSeed(account._seed)
    const { privateKey } = hdKey.derive(account._path, true)
    account._signer = await createKeyPairSignerFromPrivateKeyBytes(privateKey)
    const publicKey = await crypto.subtle.exportKey('raw', account._signer.keyPair.publicKey)
    account._rawPublicKey = new Uint8Array(publicKey)
    account._rawPrivateKey = new Uint8Array(privateKey)
    sodium_memzero(privateKey)

    return account
  }

  /**
   * The derivation path's index of this account.
   *
   * @type {number}
   */
  get index () {
    const segments = this.path.split('/')
    return +segments[3].replace("'", '')
  }

  /**
   * The derivation path of this account.
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
 * The address of this account.
 *
 * @returns {Promise<string>} The address.
 */
  async getAddress () {
    return this._signer.address
  }

  /**
   * Signs a message.
   *
   * @param {string} message - The message to sign.
   * @returns {Promise<string>} The message's signature.
   */
  async sign (message) {
    if (!this._signer) {
      throw new Error('The wallet account has been disposed.')
    }
    const messageBytes = Buffer.from(message, 'utf8')
    const signatureBytes = await signBytes(this._signer.keyPair.privateKey, messageBytes)
    const signature = Buffer.from(signatureBytes).toString('hex')

    return signature
  }

  /**
   * Verifies a message's signature.
   *
   * @param {string} message - The original message.
   * @param {string} signature - The signature to verify.
   * @returns {Promise<boolean>} True if the signature is valid.
   */
  async verify (message, signature) {
    const messageBytes = Buffer.from(message, 'utf8')
    const signatureBytes = Buffer.from(signature, 'hex')

    const isValid = await verifySignature(this._signer.keyPair.publicKey, signatureBytes, messageBytes)

    return isValid
  }

  /**
   * Sends a transaction.
   *
   * @param {SolanaTransaction} tx - The transaction.
   * @returns {Promise<TransactionResult>} The transaction's result.
   */
  async sendTransaction (tx) {
    if (!this._signer) {
      throw new Error('The wallet account has been disposed.')
    }

    if (!this._rpc) {
      throw new Error('The wallet must be connected to a provider to send transactions.')
    }

    let transactionMessage = tx
    if (tx?.to !== undefined && tx?.value !== undefined) {
      // Handle native token transfer { to, value } transaction
      transactionMessage = await this._buildNativeTransferTransactionMessage(tx.to, tx.value)
    }
    if (transactionMessage?.instructions !== undefined && Array.isArray(transactionMessage.instructions)) {
      // Check if blockhash/lifetime is missing and add it
      if (!transactionMessage.lifetimeConstraint) {
        const { value: latestBlockhash } = await this._rpc.getLatestBlockhash({
          commitment: this._commitment
        }).send()

        transactionMessage = setTransactionMessageLifetimeUsingBlockhash(
          latestBlockhash,
          transactionMessage
        )
      }

      // Check and verify fee payer
      if (transactionMessage?.feePayer) {
        // Verify the fee payer is the current account
        const feePayerAddress = typeof transactionMessage.feePayer === 'string'
          ? transactionMessage.feePayer
          : transactionMessage.feePayer.address

        if (feePayerAddress !== this._signer.address) {
          throw new Error(`Transaction fee payer (${feePayerAddress}) does not match wallet address (${this._signer.address})`)
        }
      }
      transactionMessage = setTransactionMessageFeePayerSigner(this._signer, transactionMessage)
    }

    const fee = await this._getTransactionFee(transactionMessage)

    const signedtransaction = await signTransactionMessageWithSigners(transactionMessage)

    const encodedTransaction = getBase64EncodedWireTransaction(signedtransaction)
    const signature = await this._rpc.sendTransaction(encodedTransaction, { encoding: 'base64' }).send()

    return {
      hash: signature,
      fee
    }
  }

  /**
   * Transfers a token to another address.
   *
   * @param {TransferOptions} options - The transfer's options.
   * @returns {Promise<TransferResult>} The transfer's result.
   * @note only SPL tokens - won't work for native SOL
   */
  async transfer (options) {
    if (!this._signer) {
      throw new Error('The wallet account has been disposed.')
    }

    if (!this._rpc) {
      throw new Error('The wallet must be connected to a provider to transfer tokens.')
    }

    const { token, recipient, amount } = options

    const transactionMessage = await this._buildSPLTransferTransactionMessage(
      token,
      recipient,
      amount
    )
    const fee = await this._getTransactionFee(transactionMessage)
    if (this._config.transferMaxFee !== undefined && fee >= this._config.transferMaxFee) {
      throw new Error('Exceeded maximum fee cost for transfer operation.')
    }

    const { hash } = await this.sendTransaction(transactionMessage)

    return { hash, fee }
  }

  /**
   * Returns a read-only copy of the account.
   *
   * @returns {Promise<WalletAccountReadOnlySolana>} The read-only account.
   */
  async toReadOnlyAccount () {
    const address = await this.getAddress()

    const readOnlyAccount = new WalletAccountReadOnlySolana(address, this._config)

    return readOnlyAccount
  }

  /**
   * Disposes the wallet account, erasing the private key from the memory.
   */
  dispose () {
    sodium_memzero(this._rawPrivateKey)
    this._rawPrivateKey = undefined
    this._signer = undefined
    this._seed = undefined
  }
}
