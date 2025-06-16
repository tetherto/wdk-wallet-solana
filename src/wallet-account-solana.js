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
  getUtf8Encoder,
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
import { HDKey } from 'micro-ed25519-hdkey'
import bs58 from 'bs58'
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

/**
 * @typedef {import("@wdk/wallet").IWalletAccount} IWalletAccount
 */

/** @typedef {import('@wdk/wallet').KeyPair} KeyPair */

/** @typedef {import('@wdk/wallet').Transaction} Transaction */

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
   * @private
   */
  _rpc
  /**
   * @private
   */
  _rpcSubscriptions
  /**
   * @private
   */
  _path
  /**
   * @private
   */
  _config
  /**
   * @private
   */
  _connection
  /**
   * @private
   */
  _signer
  /**
   * @private
   */
  _seedBuffer
  /**
   * @private
   */
  _keypair
  /**
   * @private
   */
  _secretKeyBuffer
  /**
   * @private
   */
  _publicKeyBuffer
  /**
   * @private
   */
  _privateKeyBuffer

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

  constructor (seed, path, config = {}) {
    if (typeof seed === 'string') {
      if (!bip39.validateMnemonic(seed)) {
        throw new Error('The seed phrase is invalid.')
      }
      seed = bip39.mnemonicToSeedSync(seed)
    }

    this._seedBuffer = seed
    this._path = `${BIP_44_SOL_DERIVATION_PATH_PREFIX}/${path}`
    this._config = config
  }

  /**
   * Initializes the wallet account.
   * @private
   * @returns {Promise<void>}
   */
  async _initialize () {
    const hd = HDKey.fromMasterSeed(this._seedBuffer)
    const child = hd.derive(this._path)

    this._secretKeyBuffer = new Uint8Array(64)
    this._privateKeyBuffer = new Uint8Array(child.privateKey)
    this._publicKeyBuffer = new Uint8Array(child.publicKey)

    this._signer = await createKeyPairSignerFromPrivateKeyBytes(this._privateKeyBuffer)

    // Remove version byte from public key
    const publicKeyWithoutVersion = this._publicKeyBuffer.slice(1)

    // Copy private key to first 32 bytes
    this._secretKeyBuffer.set(this._privateKeyBuffer)
    // Copy public key (without version byte) to last 32 bytes
    this._secretKeyBuffer.set(publicKeyWithoutVersion, 32)

    // Create keypair from the 64-byte secret key
    this._keypair = Keypair.fromSecretKey(this._secretKeyBuffer)

    const { rpcUrl, wsUrl } = this._config
    if (rpcUrl) {
      this._rpc = createSolanaRpc(rpcUrl)
      this._connection = new Connection(rpcUrl, 'processed')
    }
    if (wsUrl) {
      this._rpcSubscriptions = createSolanaRpcSubscriptions(wsUrl)
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
      privateKey: this._privateKeyBuffer,
      publicKey: this._publicKeyBuffer
    }
  }

  /**
   * Returns the account's address.
   *
   * @returns {Promise<string>} The account's address.
   */
  async getAddress () {
    if (!this._signer) {
      throw new Error('The wallet must be initialized to get the address.')
    }
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
      throw new Error('The wallet must be initialized to sign messages.')
    }
    const messageBytes = getUtf8Encoder().encode(message)

    const signedBytes = await signBytes(
      this._signer.keyPair.privateKey,
      messageBytes
    )

    const signature = bs58.encode(signedBytes)
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
    if (!this._signer) {
      throw new Error('The wallet must be initialized to verify messages.')
    }
    const messageBytes = getUtf8Encoder().encode(message)
    const signatureBytes = bs58.decode(signature)

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
   * @param {Transaction} tx - The transaction details
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
   * @param {Transaction} tx - The transaction to send.
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
   * @param {Transaction} tx - The transaction to quote.
   * @returns {Promise<Omit<TransactionResult,'hash'>>} The transaction's quotes.
   */
  async quoteSendTransaction (tx) {
    if (!this._rpc) {
      throw new Error(
        'The wallet must be connected to a provider to quote transactions.'
      )
    }

    const { transactionMessage } = await this._createTransactionMessage(tx, 'legacy')

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
    const walletPublicKey = new PublicKey(this._publicKeyBuffer)

    const tokenAccounts = await this._connection.getTokenAccountsByOwner(
      walletPublicKey,
      {
        mint: tokenMint
      }
    )

    const balance = await this._connection.getTokenAccountBalance(
      tokenAccounts.value[0].pubkey
    )
    return Number(balance.value.amount)
  }

  /**
   * Creates a transfer transaction.
   * @private
   * @param {TransferOptions} params - The transaction parameters.
   * @returns {Promise<Transaction>} The transfer transaction.
   */
  async _createTransfer ({ recipient, token, amount }) {
    const mint = new PublicKey(token)
    const to = new PublicKey(recipient)
    const sender = new PublicKey(this._publicKeyBuffer)

    // Create Token object
    const tokenClient = new Token(
      this._connection,
      mint,
      TOKEN_PROGRAM_ID,
      this._keypair
    )

    // Get associated token accounts
    const fromTokenAccount = await tokenClient.getOrCreateAssociatedAccountInfo(sender)
    const toTokenAccount = await tokenClient.getOrCreateAssociatedAccountInfo(to)
    console.log(`From: ${fromTokenAccount.address.toBase58()}`)
    console.log(`To: ${toTokenAccount.address.toBase58()}`)

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

    transaction.sign(this._keypair)
    return transaction
  }

  /**
   * Quotes a token transfer.
   *
   * @param {TransferOptions} params - The transaction parameters.
   * @returns {Promise<Omit<TransactionResult,'hash'>>} The transaction's quotes.
   */
  async quoteTransfer ({ recipient, token, amount }) {
    console.log(`Quoting transfer of ${amount} tokens to ${recipient}...`, token)
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
   * Disposes of the wallet account.
   * @returns {void}
   */
  dispose () {
    sodium.sodium_memzero(this._seedBuffer)
    sodium.sodium_memzero(this._secretKeyBuffer)
    sodium.sodium_memzero(this._publicKeyBuffer)
    sodium.sodium_memzero(this._privateKeyBuffer)
    this._path = null
    this._config = null
    this._signer = null
    this._seedBuffer = null
    this._keypair = null
    this._connection = null
    this._rpc = null
    this._rpcSubscriptions = null
    this._secretKeyBuffer = null
    this._publicKeyBuffer = null
    this._privateKeyBuffer = null
  }
}
