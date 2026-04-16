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

import { getBase64EncodedWireTransaction } from '@solana/transactions'
import { compileTransactionMessage } from '@solana/transaction-messages'

import WalletAccountReadOnlySolana from './wallet-account-read-only-solana.js'

/** @typedef {import("@tetherto/wdk-wallet").IWalletAccount} IWalletAccount */
/** @typedef {import('@tetherto/wdk-wallet').KeyPair} KeyPair */
/** @typedef {import('@tetherto/wdk-wallet').TransactionResult} TransactionResult */
/** @typedef {import('@tetherto/wdk-wallet').TransferOptions} TransferOptions */
/** @typedef {import('@tetherto/wdk-wallet').TransferResult} TransferResult */

/** @typedef {import('@solana/signers').KeyPairSigner} KeyPairSigner */

/** @typedef {import('./wallet-account-read-only-solana.js').SolanaTransaction} SolanaTransaction */
/** @typedef {import('./wallet-account-read-only-solana.js').SolanaWalletConfig} SolanaWalletConfig */
/** @typedef {import('@tetherto/wdk-wallet-solana/signers').ISignerSolana} ISignerSolana */

/**
 * Full-featured Solana wallet account implementation with signing capabilities.
 *
 */
export default class WalletAccountSolana extends WalletAccountReadOnlySolana {
  /**
   * Creates a new solana wallet account.
   *
   * @param {ISignerSolana} signer - The solana signer.
   * @param {SolanaWalletConfig} config - The wallet account configuration.
   */
  constructor (signer, config = {}) {
    if (!signer) {
      throw new Error('A signer is required.')
    }
    if (signer.isRoot) {
      throw new Error(
        'The signer is the root signer. Call derive method to create a child signer.'
      )
    }

    super(undefined, config)

    /**
     * The wallet account configuration.
     *
     * @protected
     * @type {SolanaWalletConfig}
     */
    this._config = config

    /**
     * The Solana seed signer.
     *
     * @private
     * @type {ISignerSolana}
     */
    this._signer = signer
  }

  /**
   * The derivation path's index of this account.
   *
   * @type {number}
   */
  get index () {
    return this._signer.index
  }

  /**
   * The derivation path of this account.
   *
   * @type {string}
   */
  get path () {
    return this._signer.path
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
    return this._signer.keyPair
  }

  /**
   * The address of this account.
   *
   * @returns {Promise<string>} The address.
   */
  async getAddress () {
    return await this._signer.getAddress()
  }

  /**
   * Signs a message.
   *
   * @param {string} message - The message to sign.
   * @returns {Promise<string>} The message's signature.
   */
  async sign (message) {
    if (!this._signer.path) {
      throw new Error('The wallet account has been disposed.')
    }

    const signature = await this._signer.sign(message)

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
    const isValid = await this._signer.verify(message, signature)

    return isValid
  }

  /**
   * Sends a transaction.
   *
   * @param {SolanaTransaction} tx - The transaction.
   * @returns {Promise<TransactionResult>} The transaction's result.
   */
  async sendTransaction (tx) {
    if (!this._signer.path) {
      throw new Error('The wallet account has been disposed.')
    }

    if (!this._rpc) {
      throw new Error(
        'The wallet must be connected to a provider to send transactions.'
      )
    }

    let transactionMessage = tx

    // Handle native token transfer { to, value } transaction
    if (tx.to !== undefined && tx.value !== undefined) {
      transactionMessage = await this._buildNativeTransferTransactionMessage(tx.to, tx.value)
    }

    if (Array.isArray(transactionMessage.instructions)) {
      transactionMessage = await this._ensureLifetime(transactionMessage)
      transactionMessage = await this._ensureFeePayer(transactionMessage)
    }

    const fee = await this._getTransactionFee(transactionMessage)

    const unsignedTransaction = getBase64EncodedWireTransaction(
      compileTransactionMessage(transactionMessage)
    )

    const signedTransaction = await this._signer.signTransaction(
      Buffer.from(unsignedTransaction, 'base64')
    )

    const hash = await this._rpc
      .sendTransaction(signedTransaction.toString('base64'), { encoding: 'base64' })
      .send()

    return { hash, fee }
  }

  /**
   * Transfers a token to another address.
   *
   * @param {TransferOptions} options - The transfer's options.
   * @returns {Promise<TransferResult>} The transfer's result.
   * @note only SPL tokens - won't work for native SOL
   */
  async transfer (options) {
    if (!this._signer?.path) {
      throw new Error('The wallet account has been disposed.')
    }

    if (!this._rpc) {
      throw new Error(
        'The wallet must be connected to a provider to transfer tokens.'
      )
    }

    const { token, recipient, amount } = options

    const transactionMessage = await this._buildSPLTransferTransactionMessage(token, recipient, amount)
    const fee = await this._getTransactionFee(transactionMessage)
    if (
      this._config.transferMaxFee !== undefined &&
      fee >= this._config.transferMaxFee
    ) {
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

    const readOnlyAccount = new WalletAccountReadOnlySolana(
      address,
      this._config
    )

    return readOnlyAccount
  }

  /**
   * Disposes the wallet account, erasing the private key from the memory.
   */
  dispose () {
    this._signer.dispose()
  }
}
