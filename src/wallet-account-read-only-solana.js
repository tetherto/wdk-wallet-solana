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

import { WalletAccountReadOnly } from '@tetherto/wdk-wallet'

import { Connection, PublicKey, Transaction, VersionedTransaction, SystemProgram } from '@solana/web3.js'

import { Token, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token'

/** @typedef {ReturnType<import("@solana/rpc").createSolanaRpc>} SolanaRpc */
/** @typedef {ReturnType<import("@solana/rpc-api").SolanaRpcApi['getTransaction']>} SolanaTransactionReceipt */

/** @typedef {import('@solana/transaction-messages').TransactionMessage} TransactionMessage */

/** @typedef {import('@tetherto/wdk-wallet').TransactionResult} TransactionResult */
/** @typedef {import('@tetherto/wdk-wallet').TransferOptions} TransferOptions */
/** @typedef {import('@tetherto/wdk-wallet').TransferResult} TransferResult */

/**
 * @typedef {Object} TransferNativeTransaction
 * @property {string} to - The transaction's recipient address.
 * @property {number | bigint} value - The amount of SOL to send (in lamports).
 *
 * Note: This type is defined to match the interface from @tetherto/wdk-wallet
 * for consistency across different blockchain implementations.
 */

/**
 * Union type that accepts TransferNativeTransaction, legacy Solana transactions, or versioned transactions.
 * @typedef {TransferNativeTransaction | Transaction | VersionedTransaction} SolanaTransaction
 */

/**
 * @typedef {Object} SolanaWalletConfig
 * @property {string} [rpcUrl] - The provider's rpc url.
 * @property {string} [commitment] - The commitment level ('processed', 'confirmed', or 'finalized').
 * @property {number | bigint} [transferMaxFee] - The maximum fee amount for transfer operations.
 */

export default class WalletAccountReadOnlySolana extends WalletAccountReadOnly {
  /**
   * Creates a new solana read-only wallet account.
   *
   * @param {string} address - The account's address.
   * @param {Omit<SolanaWalletConfig, 'transferMaxFee'>} [config] - The configuration object.
   */
  constructor (address, config = { }) {
    super(address)

    /**
     * The read-only wallet account configuration.
     *
     * @protected
     * @type {Omit<SolanaWalletConfig, 'transferMaxFee'>}
     */
    this._config = config

    const { rpcUrl, commitment = 'confirmed' } = config

    if (rpcUrl) {
      /**
       * A connection to a full node json rpc endpoint.
       *
       * @protected
       * @type {Connection}
       */
      this._connection = new Connection(rpcUrl, commitment)
    }
  }

  /**
   * Returns the account's sol balance.
   *
   * @returns {Promise<bigint>} The sol balance (in lamports).
   */
  async getBalance () {
    if (!this._connection) {
      throw new Error('The wallet must be connected to a provider to retrieve balances.')
    }

    const address = await this.getAddress()

    const balance = await this._connection.getBalance(new PublicKey(address))

    return BigInt(balance)
  }

  /**
   * Returns the account balance for a specific token.
   *
   * @param {string} tokenAddress - The smart contract address of the token.
   * @returns {Promise<bigint>} The token balance (in base unit).
   */
  async getTokenBalance (tokenAddress) {
    if (!this._connection) {
      throw new Error('The wallet must be connected to a provider to retrieve token balances.')
    }

    const address = await this.getAddress()
    const ownerAddress = new PublicKey(address)
    const mint = new PublicKey(tokenAddress)

    // Get the Associated Token Account address
    const ata = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      mint,
      ownerAddress
    )

    const accountInfo = await this._connection.getAccountInfo(ata)
    if (!accountInfo) {
      // ATA doesn't exist, user has never received this token
      return 0n
    }

    const { value: { amount } } = await this._connection.getTokenAccountBalance(ata)

    return BigInt(amount)
  }

  /**
   * Quotes the costs of a send transaction operation.
   *
   * @param {SolanaTransaction} tx - The transaction.
   * @returns {Promise<{fee: bigint}>} Object containing the estimated transaction fee in lamports.
   */
  async quoteSendTransaction (tx) {
    if (!this._connection) {
      throw new Error('The wallet must be connected to a provider to quote transactions.')
    }

    let feeValue

    if (tx instanceof VersionedTransaction) {
      const { value: fee } = await this._connection.getFeeForMessage(tx.message)
      feeValue = fee
    } else if (tx instanceof Transaction) {
      if (!tx.feePayer) {
        const address = await this.getAddress()
        tx.feePayer = new PublicKey(address)
      }

      if (!tx.recentBlockhash) {
        const { blockhash } = await this._connection.getLatestBlockhash()
        tx.recentBlockhash = blockhash
      }
      const message = tx.compileMessage()
      const { value: fee } = await this._connection.getFeeForMessage(message)
      feeValue = fee
    } else {
      // Handle TransferNativeTransaction { to, value }
      if (tx?.to === undefined || tx?.value === undefined) {
        throw new Error('Invalid transaction object. Must be { to, value }, Transaction, or VersionedTransaction.')
      }
      const { to, value } = tx
      const transferNativeTx = await this._buildNativeTransferTransaction(to, value)
      const { value: fee } = await this._connection.getFeeForMessage(transferNativeTx.compileMessage())
      feeValue = fee
    }

    return { fee: BigInt(feeValue) }
  }

  /**
   * Quotes the costs of a transfer operation.
   *
   * @param {TransferOptions} options - The transfer's options.
   * @returns {Promise<{fee: bigint}>} Object containing the estimated transfer fee in lamports.
   */
  async quoteTransfer (options) {
    if (!this._connection) {
      throw new Error('The wallet must be connected to a provider to quote transfer operations.')
    }
    const { token, recipient, amount } = options
    const tx = await this._buildSPLTransferTransaction(token, recipient, amount)

    // Calculate fee
    const message = tx.compileMessage()
    const { value: feeValue } = await this._connection.getFeeForMessage(message)

    return { fee: BigInt(feeValue) }
  }

  /**
   * Returns a transaction's receipt.
   *
   * @param {string} hash - The transaction's hash.
   * @returns {Promise<SolanaTransactionReceipt>} – The receipt, or null if the transaction has not been included in a block yet.
   */
  async getTransactionReceipt (hash) {
    if (!this._connection) {
      throw new Error('The wallet must be connected to a provider to fetch transaction receipts.')
    }

    const transaction = await this._connection.getTransaction(hash, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0
    })

    return transaction
  }

  /**
   * Builds a transaction for SPL token transfer.
   * Creates instructions for ATA creation (if needed) and token transfer.
   *
   * @private
   * @param {string} token - The SPL token mint address (base58-encoded public key).
   * @param {string} recipient - The recipient's wallet address (base58-encoded public key).
   * @param {number | bigint} amount - The amount to transfer in token's base units (must be ≤ 2^64-1).
   * @returns {Promise<Transaction>} The constructed transaction ready for signing or fee calculation.
   * @todo Support Token-2022 (Token Extensions Program).
   * @todo Support transfer with memo for tokens that require it.
   */
  async _buildSPLTransferTransaction (token, recipient, amount) {
    const address = await this.getAddress()
    const ownerPublicKey = new PublicKey(address)
    const tokenMint = new PublicKey(token)
    const recipientPublicKey = new PublicKey(recipient)

    // Get associated token addresses
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
        ownerPublicKey
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

    // Set transaction properties
    const { blockhash } = await this._connection.getLatestBlockhash()
    tx.recentBlockhash = blockhash
    tx.feePayer = ownerPublicKey

    return tx
  }

  /**
 * Builds a transaction for native SOL transfer.
 * Creates a transfer instruction for sending SOL.
 *
 * @private
 * @param {string} to - The recipient's address.
 * @param {number | bigint} value - The amount of SOL to send (in lamports).
 * @returns {Promise<Transaction>} The constructed transaction ready for signing or fee calculation.
 */
  async _buildNativeTransferTransaction (to, value) {
    const address = await this.getAddress()
    const fromPublicKey = new PublicKey(address)
    const toPublicKey = new PublicKey(to)

    const transaction = new Transaction()

    // Add transfer instruction
    const transferInstruction = SystemProgram.transfer({
      fromPubkey: fromPublicKey,
      toPubkey: toPublicKey,
      lamports: BigInt(value)
    })
    transaction.add(transferInstruction)

    // Set transaction properties
    const { blockhash } = await this._connection.getLatestBlockhash()
    transaction.recentBlockhash = blockhash
    transaction.feePayer = fromPublicKey

    return transaction
  }
}
