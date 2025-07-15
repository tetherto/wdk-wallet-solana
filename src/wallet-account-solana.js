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
  address, createSolanaRpc, createSolanaRpcSubscriptions,
  createKeyPairSignerFromPrivateKeyBytes, signBytes, verifySignature,
  createTransactionMessage, setTransactionMessageFeePayerSigner, setTransactionMessageLifetimeUsingBlockhash,
  compileTransactionMessage, getCompiledTransactionMessageEncoder, getBase64Decoder,
  pipe, appendTransactionMessageInstructions, lamports,
  signTransactionMessageWithSigners, getSignatureFromTransaction, sendAndConfirmTransactionFactory
} from '@solana/kit'

import { Connection, PublicKey, Keypair, Transaction } from '@solana/web3.js'

import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'

import { getTransferSolInstruction } from '@solana-program/system'

import HDKey from 'micro-key-producer/slip10.js'

import nacl from 'tweetnacl'

import * as bip39 from 'bip39'

import { sodium_memzero } from 'sodium-universal'

/** @typedef {ReturnType<import("@solana/rpc-api").SolanaRpcApi['getTransaction']>} SolanaTransactionReceipt */

/** @typedef {import("@wdk/wallet").IWalletAccount} IWalletAccount */

/** @typedef {import('@wdk/wallet').KeyPair} KeyPair */
/** @typedef {import('@wdk/wallet').TransactionResult} TransactionResult */
/** @typedef {import('@wdk/wallet').TransferOptions} TransferOptions */
/** @typedef {import('@wdk/wallet').TransferResult} TransferResult */

/**
 * @typedef {Object} SolanaTransaction
 * @property {string} to - The transaction's recipient.
 * @property {number} value - The amount of sols to send to the recipient (in lamports).
 */

/**
 * @typedef {Object} SolanaWalletConfig
 * @property {string} [rpcUrl] - The provider's rpc url.
 * @property {string} [wsUrl] - The provider's websocket url. If not set, the rpc url will also be used for the websocket connection.
 * @property {number} [transferMaxFee] - The maximum fee amount for transfer operations.
 */

const BIP_44_SOL_DERIVATION_PATH_PREFIX = "m/44'/501'"

/** @implements {IWalletAccount} */
export default class WalletAccountSolana {
  /** @private */
  constructor (seed, path, config = {}) {
    if (typeof seed === 'string') {
      if (!bip39.validateMnemonic(seed)) {
        throw new Error('The seed phrase is invalid.')
      }

      seed = bip39.mnemonicToSeedSync(seed)
    }

    /** @private */
    this._seed = seed

    /** @private */
    this._path = `${BIP_44_SOL_DERIVATION_PATH_PREFIX}/${path}`

    /** @private */
    this._config = config

    /** @private */
    this._keyPair = undefined

    /** @private */
    this._signer = undefined

    const { rpcUrl, wsUrl } = config

    if (rpcUrl) {
      /** @private */
      this._rpc = createSolanaRpc(rpcUrl)

      /** @private */
      this._connection = new Connection(rpcUrl, 'processed')

      /** @private */
      this._rpcSubscriptions = createSolanaRpcSubscriptions(wsUrl || rpcUrl.replace('http', 'ws'))
    }
  }

  /**
   * Creates a new solana wallet account.
   *
   * @param {string | Uint8Array} seed - The wallet's [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) seed phrase.
   * @param {string} path - The BIP-44 derivation path (e.g. "0'/0/0").
   * @param {SolanaWalletConfig} [config] - The configuration object.
   */
  static async at (seed, path, config = {}) {
    const account = new WalletAccountSolana(seed, path, config)

    await account._initialize()

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

  /**
   * Returns the account's address.
   *
   * @returns {Promise<string>} The account's address.
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
   * Returns the account's sol balance.
   *
   * @returns {Promise<number>} The sol balance (in lamports).
   */
  async getBalance () {
    if (!this._rpc) {
      throw new Error('The wallet must be connected to a provider to retrieve balances.')
    }

    const address = await this.getAddress()

    const { value } = await this._rpc.getBalance(address).send()

    return Number(value)
  }

  /**
   * Returns the account balance for a specific token.
   *
   * @param {string} tokenAddress - The smart contract address of the token.
   * @returns {Promise<number>} The token balance (in base unit).
   */
  async getTokenBalance (tokenAddress) {
    if (!this._rpc) {
      throw new Error('The wallet must be connected to a provider to retrieve token balances.')
    }

    const ownerAddress = new PublicKey(this.keyPair.publicKey)
    const mint = new PublicKey(tokenAddress)

    const tokenAccounts = await this._connection.getTokenAccountsByOwner(ownerAddress, { mint })

    const account = tokenAccounts.value[0]

    if (!account) {
      return 0
    }

    const { value: { amount } } = await this._connection.getTokenAccountBalance(account.pubkey)

    return Number(amount)
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
   * Quotes the costs of a send transaction operation.
   *
   * @see {@link sendTransaction}
   * @param {SolanaTransaction} tx - The transaction.
   * @returns {Promise<Omit<TransactionResult, 'hash'>>} The transaction's quotes.
   */
  async quoteSendTransaction (tx) {
    if (!this._rpc) {
      throw new Error('The wallet must be connected to a provider to quote transactions.')
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

    return { fee: Number(fee.value) }
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
   * Quotes the costs of a transfer operation.
   *
   * @see {@link transfer}
   * @param {TransferOptions} options - The transfer's options.
   * @returns {Promise<Omit<TransferResult, 'hash'>>} The transfer's quotes.
   */
  async quoteTransfer (options) {
    if (!this._rpc) {
      throw new Error('The wallet must be connected to a provider to quote transfer operations.')
    }

    const transfer = await this._getTransfer(options)
    const message = transfer.compileMessage()
    const fee = await this._connection.getFeeForMessage(message)

    return { fee: Number(fee.value) }
  }

  /**
   * Returns a transaction's receipt.
   *
   * @param {string} hash - The transaction's hash.
   * @returns {Promise<SolanaTransactionReceipt>} – The receipt, or null if the transaction has not been included in a block yet.
   */
  async getTransactionReceipt (hash) {
    if (!this._rpc) {
      throw new Error('The wallet must be connected to a provider to fetch transaction receipts.')
    }

    const transaction = await this._rpc.getTransaction(hash, {
      commitment: 'confirmed',
      encoding: 'jsonParsed',
      maxSupportedTransactionVersion: 0
    })
      .send()

    return transaction
  }

  /**
   * Disposes the wallet account, erasing the private key from the memory.
   */
  dispose () {
    sodium_memzero(this._keyPair.secretKey)

    this._keyPair.secretKey = undefined

    this._signer = undefined
  }

  /** @private */
  async _initialize () {
    const hdKey = HDKey.fromMasterSeed(this._seed)

    const { privateKey } = hdKey.derive(this._path, true)

    this._keyPair = nacl.sign.keyPair.fromSeed(privateKey)

    this._signer = await createKeyPairSignerFromPrivateKeyBytes(privateKey)

    sodium_memzero(privateKey)
  }

  /** @private */
  async _getTransaction ({ to, value }) {
    const { value: latestBlockhash } = await this._rpc
      .getLatestBlockhash()
      .send()

    const instruction = getTransferSolInstruction({
      source: this._signer,
      destination: address(to),
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

  /** @private */
  async _getTransfer ({ token, recipient, amount }) {
    const mint = new PublicKey(token)
    const receiver = new PublicKey(recipient)

    const signer = Keypair.fromSecretKey(this._keyPair.secretKey)
    const sender = new PublicKey(signer.publicKey)

    const client = new Token(this._connection, mint, TOKEN_PROGRAM_ID, signer)

    const fromTokenAccount = await client.getOrCreateAssociatedAccountInfo(sender)
    const toTokenAccount = await client.getOrCreateAssociatedAccountInfo(receiver)

    const instruction = Token.createTransferInstruction(TOKEN_PROGRAM_ID, fromTokenAccount.address,
      toTokenAccount.address, sender, [], amount)

    const transaction = new Transaction().add(instruction)

    const { blockhash } = await this._connection.getLatestBlockhash()
    transaction.recentBlockhash = blockhash
    transaction.feePayer = sender

    transaction.sign(signer)

    return transaction
  }
}
