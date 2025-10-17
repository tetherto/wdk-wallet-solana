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

import { PublicKey, Keypair, Transaction, VersionedTransaction } from '@solana/web3.js'

import HDKey from 'micro-key-producer/slip10.js'

import nacl from 'tweetnacl'

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

/** @implements {IWalletAccount} */
export default class WalletAccountSolana extends WalletAccountReadOnlySolana {
  /** @package */
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

    /** @private */
    this._keyPair = undefined
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
    account._keyPair = Keypair.fromSeed(Buffer.from(privateKey, 'hex'))

    sodium_memzero(privateKey)

    return account
  }

  /**
   * The derivation path's index of this account.
   *
   * @type {number}
   */
  get index () {
    return +this.path.split('/').pop()
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
 * - privateKey: 64-byte Ed25519 secret key (Uint8Array)
 * - publicKey: 32-byte Ed25519 public key (Uint8Array)
 *
 * @type {KeyPair}
 */
  get keyPair () {
    if (!this._keyPair) {
      return {
        privateKey: undefined,
        publicKey: undefined
      }
    }

    return {
      privateKey: this._keyPair.secretKey,
      publicKey: this._keyPair.publicKey.toBytes()
    }
  }

  async getAddress () {
    return this._keyPair.publicKey.toBase58()
  }

  /**
   * Signs a message.
   *
   * @param {string} message - The message to sign.
   * @returns {Promise<string>} The message's signature.
   */
  async sign (message) {
    const messageBytes = Buffer.from(message, 'utf8')
    // Sign the message using native ed25519 signature
    const signature = nacl.sign.detached(
      messageBytes,
      this._keyPair.secretKey
    )

    return Buffer.from(signature).toString('hex')
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

    return nacl.sign.detached.verify(messageBytes, signatureBytes, this._keyPair.publicKey.toBytes())
  }

  /**
   * Sends a transaction. Accepts simple transactions { to, value },
   * legacy Solana Transaction objects, or VersionedTransaction objects.
   *
   * @param {SolanaTransaction} tx - The transaction.
   * @returns {Promise<TransactionResult>} The transaction's result.
   */
  async sendTransaction (tx) {
    if (!this._connection) {
      throw new Error('The wallet must be connected to a provider to send transactions.')
    }

    let signedTransaction
    let feeValue
    if (tx instanceof VersionedTransaction) {
      signedTransaction = await this._signVersionedTransaction(tx)
      const { value: fee } = await this._connection.getFeeForMessage(signedTransaction.message)
      feeValue = fee
    } else if (tx instanceof Transaction) {
      signedTransaction = await this._signLegacyTransaction(tx)
      const { value: fee } = await this._connection.getFeeForMessage(signedTransaction.compileMessage())
      feeValue = fee
    } else {
      // Handle TransferNativeTransaction { to, value }
      if (tx?.to === undefined || tx?.value === undefined) {
        throw new Error('Invalid transaction object. Must be { to, value }, Transaction, or VersionedTransaction.')
      }
      const { to, value } = tx
      const transferNativeTx = await this._buildNativeTransferTransaction(to, value)
      signedTransaction = await this._signLegacyTransaction(transferNativeTx)
      const { value: fee } = await this._connection.getFeeForMessage(signedTransaction.compileMessage())
      feeValue = fee
    }

    const signature = await this._connection.sendRawTransaction(signedTransaction.serialize())
    const { lastValidBlockHeight, blockhash } = await this._connection.getLatestBlockhash()

    await this._connection.confirmTransaction(
      {
        blockhash,
        lastValidBlockHeight,
        signature
      },
      'confirmed'
    )

    return { hash: signature, fee: BigInt(feeValue) }
  }

  /**
 * Signs a legacy Solana Transaction object.
 *
 * @private
 * @param {Transaction} transaction - The legacy transaction.
 * @returns {Promise<Transaction>} The signed transaction.
 */
  async _signLegacyTransaction (transaction) {
    const address = await this.getAddress()
    const publicKey = new PublicKey(address)

    if (transaction.feePayer) {
      if (!transaction.feePayer.equals(publicKey)) {
        throw new Error('Transaction fee payer must match wallet address.')
      }
    } else {
      transaction.feePayer = publicKey
    }

    if (!transaction.recentBlockhash) {
      const { blockhash } = await this._connection.getLatestBlockhash()
      transaction.recentBlockhash = blockhash
    }

    const keypair = Keypair.fromSecretKey(this._keyPair.secretKey)
    transaction.sign(keypair)

    return transaction
  }

  /**
   * Signs a VersionedTransaction object.
   *
   * @private
   * @param {VersionedTransaction} transaction - The versioned transaction.
   * @returns {Promise<VersionedTransaction>} The signed transaction.
   */
  async _signVersionedTransaction (transaction) {
    const address = await this.getAddress()
    const publicKey = new PublicKey(address)

    const feePayer = transaction.message.staticAccountKeys[0]
    if (!feePayer.equals(publicKey)) {
      throw new Error('Transaction fee payer must match wallet address.')
    }

    if (!transaction.message.recentBlockhash) {
      throw new Error('VersionedTransaction must have a recentBlockhash set.')
    }

    const keypair = Keypair.fromSecretKey(this._keyPair.secretKey)
    transaction.sign([keypair])

    return transaction
  }

  /**
   * Transfers a token to another address.
   *
   * @param {TransferOptions} options - The transfer's options.
   * @returns {Promise<TransferResult>} The transfer's result.
   * @note only SPL tokens - won't work for native SOL
   */
  async transfer (options) {
    if (!this._connection) {
      throw new Error('The wallet must be connected to a provider to transfer tokens.')
    }
    const { token, recipient, amount } = options
    const tx = await this._buildSPLTransferTransaction(token, recipient, amount)

    if (this._config.transferMaxFee !== undefined) {
      const message = tx.compileMessage()
      const { value: feeValue } = await this._connection.getFeeForMessage(message)

      if (feeValue >= this._config.transferMaxFee) {
        throw new Error('Exceeded maximum fee cost for transfer operation.')
      }
    }

    const result = await this.sendTransaction(tx)

    return result
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
    sodium_memzero(this._keyPair.secretKey)

    this._keyPair = undefined

    this._seed = undefined
  }
}
