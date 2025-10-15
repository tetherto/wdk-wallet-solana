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
  createKeyPairSignerFromPrivateKeyBytes, signBytes,
  verifySignature
} from '@solana/kit'

import { PublicKey, Keypair, Transaction, VersionedTransaction } from '@solana/web3.js'

import { Token, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token'

import { getTransferSolInstruction } from '@solana-program/system'

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

    /** @private */
    this._signer = undefined
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
    account._keyPair = nacl.sign.keyPair.fromSeed(privateKey)

    account._signer = await createKeyPairSignerFromPrivateKeyBytes(privateKey)

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
   * @type {KeyPair}
   */
  get keyPair () {
    return {
      privateKey: this._keyPair.secretKey,
      publicKey: this._keyPair.publicKey
    }
  }

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
   * Sends a transaction. Accepts simple transactions { to, value },
   * legacy Solana Transaction objects, or VersionedTransaction objects.
   *
   * @param {SolanaTransaction} tx - The transaction.
   * @returns {Promise<TransactionResult>} The transaction's result.
   */
  async sendTransaction (tx) {
    if (!this._rpc) {
      throw new Error('The wallet must be connected to a provider to send transactions.')
    }

    let signedTransaction
    let feeValue
    if (tx instanceof VersionedTransaction) {
      signedTransaction = await this._signVersionedTransaction(tx)
      const { value } = await this._connection.getFeeForMessage(signedTransaction.message)
      feeValue = value
    } else if (tx instanceof Transaction) {
      signedTransaction = await this._signLegacyTransaction(tx)
      const { value } = await this._connection.getFeeForMessage(signedTransaction.compileMessage())
      feeValue = value
    } else {
      throw new Error('Unsupported transaction type. Solana transaction must be a VersionedTransaction, a legacy Transaction object.')
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
   * TODO: support native SOL transfer
   */
  async transfer (options) {
    if (!this._rpc) {
      throw new Error('The wallet must be connected to a provider to transfer tokens.')
    }

    const { token, recipient, amount } = options

    const address = await this.getAddress()
    const ownerPublicKey = new PublicKey(address)
    const tokenMint = new PublicKey(token)
    const recipientPublicKey = new PublicKey(recipient)

    const fromATA = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      tokenMint,
      ownerPublicKey
    )

    const toATA = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      tokenMint,
      recipientPublicKey
    )

    const tx = new Transaction()

    const recipientATAInfo = await this._connection.getAccountInfo(toATA)
    // If recipient's ATA doesn't exist, add creation instruction
    if (!recipientATAInfo) {
      const createATAInstruction = Token.createAssociatedTokenAccountInstruction(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        tokenMint,
        toATA,
        recipientPublicKey,
        ownerPublicKey // Fee payer
      )
      tx.add(createATAInstruction)
    }

    // Add transfer instruction
    const transferInstruction = Token.createTransferInstruction(
      TOKEN_PROGRAM_ID,
      fromATA,
      toATA,
      ownerPublicKey,
      [],
      amount
    )
    tx.add(transferInstruction)

    // Set blockhash and fee payer
    const { blockhash } = await this._connection.getLatestBlockhash()
    tx.recentBlockhash = blockhash
    tx.feePayer = ownerPublicKey

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

    this._keyPair.secretKey = undefined

    this._signer = undefined
  }
}
