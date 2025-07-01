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
  address,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createKeyPairSignerFromPrivateKeyBytes,
  signBytes,
  verifySignature,
  createTransactionMessage,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  compileTransactionMessage,
  getCompiledTransactionMessageEncoder,
  getBase64Decoder,
  pipe,
  appendTransactionMessageInstructions,
  lamports,
  signTransactionMessageWithSigners,
  getSignatureFromTransaction,
  sendAndConfirmTransactionFactory
} from '@solana/kit'
import { getTransferSolInstruction } from '@solana-program/system'
import * as bip39 from 'bip39'
import HDKey from 'micro-key-producer/slip10.js'
import {
  Connection,
  PublicKey,
  Keypair,
  Transaction as Web3Transaction
} from '@solana/web3.js'
import {
  Token,
  TOKEN_PROGRAM_ID
} from '@solana/spl-token'
import sodium from 'sodium-universal'
import nacl from 'tweetnacl'

/**
 * @typedef {import("@wdk/wallet").IWalletAccount} IWalletAccount
 */

/** @typedef {import('@wdk/wallet').KeyPair} KeyPair */

/**
 * @typedef {Object} SolanaTransaction
 * @property {string} to - The transaction's recipient.
 * @property {number} value - The amount of sols to send to the recipient (in lamports).
 */

/**
 * @typedef {Object} SolanaTransactionReceipt
 * @property {number} slot - The slot in which the transaction was processed.
 * @property {string} signature - The transaction signature.
 * @property {Object} meta - Metadata about the transaction, including logs and status.
 * @property {Object} transaction - The full transaction details.
 * @property {number} [blockTime] - The Unix timestamp when the block was processed.
 */

/**
 * @typedef {Object} SolanaWalletConfig
 * @property {string} [rpcUrl] - The rpc url of the provider.
 * @property {string} [wsUrl] - The ws url of the provider is optional, if not provided, it will be derived from the rpc url.
 * Note: only use this if you want to use a custom ws url.
 */

/** @typedef {import('@wdk/wallet').TransferOptions} TransferOptions */

/** @typedef {import('@wdk/wallet').TransactionResult} TransactionResult */

/** @typedef {import('@wdk/wallet').TransferResult} TransferResult */

const BIP_44_SOL_DERIVATION_PATH_PREFIX = "m/44'/501'"

/** @implements {IWalletAccount} */
export default class WalletAccountSolana {
  /**
   * Creates a new solana wallet account.
   *
   * @param {string|Uint8Array} seed - The wallet's [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) seed phrase or Uint8Array.
   * @param {string} path - The BIP-44 derivation path (e.g. "0'/0/0").
   * @param {SolanaWalletConfig} [config] - The configuration object.
   */
  static async create (seed, path, config = {}) {
    const instance = new WalletAccountSolana(seed, path, config)
    await instance._initialize()
    return instance
  }

  /**
   * Creates an new un-initialized solana wallet account.
   *
   * @package
   * @param {string|Uint8Array} seed - The wallet's [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) seed phrase or Uint8Array.
   * @param {string} path - The BIP-44 derivation path (e.g. "0'/0/0").
   * @param {SolanaWalletConfig} [config] - The configuration object.
   */
  constructor (seed, path, config = {}) {
    if (typeof seed === 'string') {
      if (!bip39.validateMnemonic(seed)) {
        throw new Error('The seed phrase is invalid.')
      }
      seed = bip39.mnemonicToSeedSync(seed)
    }

    /**
     * @private
     * @type {Uint8Array}
     * @description The seed buffer derived from the BIP-39 seed phrase.
     */
    this._seedBuffer = seed

    /**
     * @private
     * @type {string}
     * @description The BIP-44 derivation path for this account.
     * @example "m/44'/501'/0'/0/0"
     */
    this._path = `${BIP_44_SOL_DERIVATION_PATH_PREFIX}/${path}`

    /**
     * @private
     * @type {SolanaWalletConfig}
     * @description The configuration object for the wallet account.
     */
    this._config = config
  }

  /**
   * Initializes the wallet account.
   * @private
   * @returns {Promise<void>}
   */
  async _initialize () {
    const hdKey = HDKey.fromMasterSeed(this._seedBuffer)

    const { privateKey } = hdKey.derive(this._path, true)

    /** @private */
    this._signer = await createKeyPairSignerFromPrivateKeyBytes(privateKey)

    /** @private */
    this._keyPair = nacl.sign.keyPair.fromSeed(privateKey)

    sodium.sodium_memzero(privateKey)

    const { rpcUrl, wsUrl } = this._config
    if (rpcUrl) {
      this._rpc = createSolanaRpc(rpcUrl)
      this._connection = new Connection(rpcUrl, 'processed')

      this._rpcSubscriptions = createSolanaRpcSubscriptions(wsUrl || rpcUrl.replace('http', 'ws'))
    }
  }

  /**
   * The derivation path's index of this account.
   *
   * @type {number}
   */
  get index () {
    return parseInt(this.path.split('/').pop())
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

    const signedBytes = await signBytes(
      this._signer.keyPair.privateKey,
      messageBytes
    )

    const signature = Buffer.from(signedBytes).toString('hex')
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
    const isValid = await verifySignature(
      this._signer.keyPair.publicKey,
      signatureBytes,
      messageBytes
    )

    return isValid
  }

  /**
   * Creates a transaction message for sending SOL or quoting fees.
   * @private
   * @param {SolanaTransaction} tx - The transaction details
   * @param {string} version - The transaction message version ('legacy' or 0)
   * @returns {Promise<Object>} The transaction message and instructions
   */
  async _createTransactionMessage (tx, version = 0) {
    const { to, value } = tx
    const recipient = address(to)

    const { value: latestBlockhash } = await this._rpc
      .getLatestBlockhash()
      .send()

    const transferInstruction = getTransferSolInstruction({
      source: this._signer,
      destination: recipient,
      amount: lamports(BigInt(value))
    })

    const instructions = [transferInstruction]

    const transactionMessage = pipe(
      createTransactionMessage({ version }),
      (tx) => setTransactionMessageFeePayerSigner(this._signer, tx),
      (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
      (tx) => appendTransactionMessageInstructions(instructions, tx)
    )

    return { transactionMessage, instructions }
  }

  /**
   * Sends a transaction with arbitrary data.
   *
   * @param {SolanaTransaction} tx - The transaction to send.
   * @returns {Promise<TransactionResult>} The transaction's hash.
   */
  async sendTransaction (tx) {
    if (!this._rpc || !this._rpcSubscriptions) {
      throw new Error(
        'The wallet must be connected to a provider to send transactions.'
      )
    }
    const { transactionMessage } = await this._createTransactionMessage(tx)

    const base64EncodedMessage = pipe(
      transactionMessage,
      compileTransactionMessage,
      getCompiledTransactionMessageEncoder().encode,
      getBase64Decoder().decode
    )

    const fee = await this._rpc.getFeeForMessage(base64EncodedMessage).send()

    const signedTransaction = await signTransactionMessageWithSigners(
      transactionMessage
    )

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
   * Quotes a transaction.
   *
   * @param {SolanaTransaction} tx - The transaction to quote.
   * @returns {Promise<Omit<TransactionResult,'hash'>>} The transaction's quotes.
   */
  async quoteSendTransaction (tx) {
    if (!this._rpc) {
      throw new Error(
        'The wallet must be connected to a provider to quote transactions.'
      )
    }

    const { transactionMessage } = await this._createTransactionMessage(tx)

    const base64EncodedMessage = pipe(
      transactionMessage,
      compileTransactionMessage,
      getCompiledTransactionMessageEncoder().encode,
      getBase64Decoder().decode
    )

    const feeInfo = await this._rpc.getFeeForMessage(base64EncodedMessage).send()
    return { fee: Number(feeInfo.value) }
  }

  /**
   * Returns the account's native token balance.
   *
   * @returns {Promise<number>} The native token balance in lamports.
   */
  async getBalance () {
    if (!this._rpc) {
      throw new Error(
        'The wallet must be connected to a provider to retrieve balances.'
      )
    }

    const address = await this.getAddress()
    const response = await this._rpc.getBalance(address).send()
    const balance = response.value
    return Number(balance)
  }

  /**
   * Returns the account balance for a specific token.
   *
   * @param {string} tokenAddress - The smart contract address of the token.
   * @returns {Promise<number>} The token balance.
   */
  async getTokenBalance (tokenAddress) {
    if (!this._config.rpcUrl) {
      throw new Error(
        'rpcUrl is required to retrieve token balances.'
      )
    }

    const tokenMint = new PublicKey(tokenAddress)
    const walletPublicKey = new PublicKey(this.keyPair.publicKey)
    const tokenAccounts = await this._connection.getTokenAccountsByOwner(
      walletPublicKey,
      {
        mint: tokenMint
      }
    )

    if (tokenAccounts.value.length === 0) {
      return 0 // No token accounts found for this mint
    }

    const balance = await this._connection.getTokenAccountBalance(
      tokenAccounts.value[0].pubkey
    )
    return Number(balance.value.amount)
  }

  /**
   * Creates a transfer transaction.
   * @private
   * @param {TransferOptions} params - The transaction parameters.
   * @returns {Promise<Web3Transaction>} The transfer transaction.
   */
  async _createTransfer ({ recipient, token, amount }) {
    const mint = new PublicKey(token)
    const receiver = new PublicKey(recipient)
    // Note: web3.js requires the keypair to be in the format of Keypair class
    const signer = Keypair.fromSecretKey(this._keyPair.secretKey)

    const sender = new PublicKey(signer.publicKey)
    // Create Token object
    const tokenClient = new Token(
      this._connection,
      mint,
      TOKEN_PROGRAM_ID,
      signer
    )

    // Get associated token accounts
    const fromTokenAccount = await tokenClient.getOrCreateAssociatedAccountInfo(sender)
    const toTokenAccount = await tokenClient.getOrCreateAssociatedAccountInfo(receiver)

    // Create transfer instruction
    const transaction = new Web3Transaction().add(
      Token.createTransferInstruction(
        TOKEN_PROGRAM_ID,
        fromTokenAccount.address,
        toTokenAccount.address,
        sender,
        [],
        amount
      )
    )

    // Set transaction properties
    const { blockhash } = await this._connection.getLatestBlockhash()
    transaction.recentBlockhash = blockhash
    transaction.feePayer = sender

    transaction.sign(signer)
    return transaction
  }

  /**
   * Quotes a token transfer.
   *
   * @param {TransferOptions} params - The transaction parameters.
   * @returns {Promise<Omit<TransactionResult,'hash'>>} The transaction's quotes.
   */
  async quoteTransfer ({ recipient, token, amount }) {
    const transaction = await this._createTransfer({ recipient, token, amount })
    const message = transaction.compileMessage() // Returns a Message object
    const feeInfo = await this._connection.getFeeForMessage(message)
    return { fee: Number(feeInfo.value) }
  }

  /**
   * Sends a token transaction.
   *
   * @param {TransferOptions} params - The transaction parameters.
   * @returns {Promise<TransactionResult>} The transaction's hash.
   */
  async transfer ({ recipient, token, amount }) {
    const transaction = await this._createTransfer({ recipient, token, amount })

    const message = transaction.compileMessage() // Returns a Message object
    const feeInfo = await this._connection.getFeeForMessage(message)

    const signature = await this._connection.sendRawTransaction(
      transaction.serialize()
    )

    return { hash: signature, fee: Number(feeInfo.value) }
  }

  /**
 * Returns a solana transaction's detail
 * @param {string} hash - The transaction's hash.
 * @returns {Promise<SolanaTransactionReceipt | null>} The transaction's hash.
 */
  async getTransactionReceipt (hash) {
    const tx = await this._rpc.getTransaction(hash, {
      encoding: 'jsonParsed',
      maxSupportedTransactionVersion: 0,
      commitment: 'confirmed'
    }).send()
    return tx
  }

  /**
   * Disposes of the wallet account.
   * @returns {void}
   */
  dispose () {
    sodium.sodium_memzero(this._keyPair.secretKey)
    this._keyPair.secretKey = undefined
  }
}
