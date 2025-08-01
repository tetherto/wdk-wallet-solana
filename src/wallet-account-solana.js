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
  address as _address, createKeyPairSignerFromPrivateKeyBytes, signBytes,
  verifySignature, createTransactionMessage, setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash, compileTransactionMessage, getCompiledTransactionMessageEncoder,
  getBase64Decoder, pipe, appendTransactionMessageInstructions,
  lamports, signTransactionMessageWithSigners, getSignatureFromTransaction,
  sendAndConfirmTransactionFactory
} from '@solana/kit'

import { PublicKey, Keypair, Transaction } from '@solana/web3.js'

import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'

import { getTransferSolInstruction } from '@solana-program/system'

import HDKey from 'micro-key-producer/slip10.js'

import nacl from 'tweetnacl'

import * as bip39 from 'bip39'

// eslint-disable-next-line camelcase
import { sodium_memzero } from 'sodium-universal'

import WalletAccountReadOnlySolana from './wallet-account-read-only-solana.js'

/** @typedef {import("@wdk/wallet").IWalletAccount} IWalletAccount */

/** @typedef {import('@wdk/wallet').KeyPair} KeyPair */
/** @typedef {import('@wdk/wallet').TransactionResult} TransactionResult */
/** @typedef {import('@wdk/wallet').TransferOptions} TransferOptions */
/** @typedef {import('@wdk/wallet').TransferResult} TransferResult */

/** @typedef {import('./wallet-account-read-only-solana.js').SolanaTransaction} SolanaTransaction */
/** @typedef {import('./wallet-account-read-only-solana.js').SolanaWalletConfig} SolanaWalletConfig */

const BIP_44_SOL_DERIVATION_PATH_PREFIX = "m/44'/501'"

/** @implements {IWalletAccount} */
export default class WalletAccountSolana extends WalletAccountReadOnlySolana {
  /** @private */
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

    const hdKey = HDKey.fromMasterSeed(seed)

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
   * Sends a transaction.
   *
   * @param {SolanaTransaction} tx - The transaction.
   * @returns {Promise<TransactionResult>} The transaction's result.
   */
  async sendTransaction (tx) {
    if (!this._rpc) {
      throw new Error('The wallet must be connected to a provider to send transactions.')
    }

    const transaction = await this._getTransaction(tx)

    const compiledTransactionMessageEncoder = getCompiledTransactionMessageEncoder()
    const base64Decoder = getBase64Decoder()

    const base64EncodedMessage = pipe(
      transaction,
      compileTransactionMessage,
      compiledTransactionMessageEncoder.encode,
      base64Decoder.decode
    )

    const fee = await this._rpc.getFeeForMessage(base64EncodedMessage).send()

    const signedTransaction = await signTransactionMessageWithSigners(transaction)

    const sendAndConfirm = sendAndConfirmTransactionFactory({
      rpc: this._rpc,
      rpcSubscriptions: this._rpcSubscriptions
    })

    await sendAndConfirm(signedTransaction, {
      commitment: 'processed'
    })

    const hash = getSignatureFromTransaction(signedTransaction)

    return { hash, fee: Number(fee.value) }
  }

  /**
   * Transfers a token to another address.
   *
   * @param {TransferOptions} options - The transfer's options.
   * @returns {Promise<TransferResult>} The transfer's result.
   */
  async transfer (options) {
    if (!this._rpc) {
      throw new Error('The wallet must be connected to a provider to transfer tokens.')
    }

    const transfer = await this._getTransfer(options)
    const message = transfer.compileMessage()
    const { value } = await this._connection.getFeeForMessage(message)

    const fee = Number(value)

    // eslint-disable-next-line eqeqeq
    if (this._config.transferMaxFee != undefined && fee >= this._config.transferMaxFee) {
      throw new Error('Exceeded maximum fee cost for transfer operation.')
    }

    const transaction = transfer.serialize()
    const hash = await this._connection.sendRawTransaction(transaction)

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
    sodium_memzero(this._keyPair.secretKey)

    this._keyPair.secretKey = undefined

    this._signer = undefined
  }

  async _getTransaction ({ to, value }) {
    const { value: latestBlockhash } = await this._rpc.getLatestBlockhash()
      .send()

    const instruction = getTransferSolInstruction({
      source: this._signer,
      destination: _address(to),
      amount: lamports(BigInt(value))
    })

    const transaction = pipe(
      createTransactionMessage({ version: 0 }),
      (tx) => setTransactionMessageFeePayerSigner(this._signer, tx),
      (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
      (tx) => appendTransactionMessageInstructions([instruction], tx)
    )

    return transaction
  }

  async _getTransfer ({ token, recipient, amount }) {
    const address = await this.getAddress()

    const _address = new PublicKey(address)
    const _token = new PublicKey(token)
    const _recipient = new PublicKey(recipient)

    const signer = Keypair.fromSecretKey(this._keyPair.secretKey)

    const client = new Token(this._connection, _token, TOKEN_PROGRAM_ID, signer)

    const fromTokenAccount = await client.getOrCreateAssociatedAccountInfo(_address)
    const toTokenAccount = await client.getOrCreateAssociatedAccountInfo(_recipient)

    const instruction = Token.createTransferInstruction(TOKEN_PROGRAM_ID, fromTokenAccount.address,
      toTokenAccount.address, _address, [], amount)

    const transaction = new Transaction().add(instruction)

    const { blockhash } = await this._connection.getLatestBlockhash()
    transaction.recentBlockhash = blockhash
    transaction.feePayer = _address

    transaction.sign(signer)

    return transaction
  }
}
