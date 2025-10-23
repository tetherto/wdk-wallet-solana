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

import { address } from '@solana/addresses'
import { createSolanaRpc } from '@solana/rpc'
import { pipe } from '@solana/functional'
import {
  createTransactionMessage,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstruction,
  appendTransactionMessageInstructions,
  getCompiledTransactionMessageEncoder,
  setTransactionMessageFeePayer,
  compileTransactionMessage
} from '@solana/transaction-messages'
import { getBase64Decoder } from '@solana/codecs'

import {
  getTransferSolInstruction
} from '@solana-program/system'

import {
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstruction,
  getTransferInstruction,
  TOKEN_PROGRAM_ADDRESS
} from '@solana-program/token'

/** @typedef {import('@tetherto/wdk-wallet').TransactionResult} TransactionResult */
/** @typedef {import('@tetherto/wdk-wallet').TransferOptions} TransferOptions */
/** @typedef {import('@tetherto/wdk-wallet').TransferResult} TransferResult */
/** @typedef {import('@solana/transaction-messages').TransactionMessage} TransactionMessage */
/** @typedef {ReturnType<typeof import('@solana/rpc').createSolanaRpc>} SolanaRpc */
/** @typedef {ReturnType<import("@solana/rpc-api").SolanaRpcApi['getTransaction']>} SolanaTransactionReceipt */

/**
 * @typedef {Object} SimpleSolanaTransaction
 * @property {string} to - The recipient's Solana address.
 * @property {number | bigint} value - The amount of SOL to send in lamports (1 SOL = 1,000,000,000 lamports).
 */

/**
 * @typedef {SimpleSolanaTransaction | TransactionMessage} SolanaTransaction
 * @description
 * Union type that accepts either:
 * - SimpleSolanaTransaction: {to, value} object for native SOL transfers
 * - TransactionMessage: Full Solana transaction message with instructions, fee payer, and lifetime
 */

/**
 * @typedef {Object} SolanaWalletConfig
 * @property {string} [rpcUrl] - The provider's rpc url.
 * @property {'processed' | 'confirmed' | 'finalized'} [commitment] - The commitment level (default: 'confirmed').
 * @property {number | bigint} [transferMaxFee] - Maximum allowed fee in lamports for transfer operations.
 */

/**
 * Read-only Solana wallet account implementation.
 *
 */
export default class WalletAccountReadOnlySolana extends WalletAccountReadOnly {
  /**
   * Creates a new solana read-only wallet account.
   *
   * @param {string} addr - The account's address.
   * @param {Omit<SolanaWalletConfig, 'transferMaxFee'>} [config] - The configuration object.
   */
  constructor (addr, config = {}) {
    super(addr)

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
       * Solana RPC client for making HTTP requests to the blockchain.
       *
       * @protected
       * @type {SolanaRpc}
       */
      this._rpc = createSolanaRpc(rpcUrl)

      /**
       * The commitment level for querying transaction and account states.
       * Determines the level of finality required before returning results.
       *
       * @protected
       * @type {string}
       */
      this._commitment = commitment
    }
  }

  /**
   * Returns the account's native SOL balance.
   *
   * @returns {Promise<bigint>} The sol balance (in lamports).
   */
  async getBalance () {
    if (!this._rpc) {
      throw new Error('The wallet must be connected to a provider to retrieve balances.')
    }

    const addr = await this.getAddress()
    const balance = await this._rpc.getBalance(addr, { commitment: this._commitment }).send()

    return balance.value
  }

  /**
   * Returns the account balance for a specific SPL token.
   *
   * @param {string} tokenAddress - The smart contract address of the token.
   * @returns {Promise<bigint>} The token balance (in base unit).
   */
  async getTokenBalance (tokenAddress) {
    if (!this._rpc) {
      throw new Error('The wallet must be connected to a provider to retrieve token balances.')
    }

    const addr = await this.getAddress()
    const ownerAddress = address(addr)
    const mint = address(tokenAddress)

    const [ata] = await findAssociatedTokenPda({
      mint,
      owner: ownerAddress,
      tokenProgram: TOKEN_PROGRAM_ADDRESS
    })
    const accountInfo = await this._rpc.getAccountInfo(ata, { commitment: this._commitment, encoding: 'base64' }).send()

    if (!accountInfo.value) {
      // ATA doesn't exist, user has never received this token
      return 0n
    }

    const tokenAccountBalance = await this._rpc.getTokenAccountBalance(ata, { commitment: this._commitment }).send()

    return BigInt(tokenAccountBalance.value.amount)
  }

  /**
 * Quotes the costs of a send transaction operation.
 *
 * @param {SolanaTransaction} tx - The transaction.
 * @returns {Promise<Omit<TransactionResult, 'hash'>>} The transaction's quotes.
 */
  async quoteSendTransaction (tx) {
    if (!this._rpc) {
      throw new Error('The wallet must be connected to a provider to quote transactions.')
    }

    const addr = await this.getAddress()
    const ownerAddress = address(addr)
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

        if (feePayerAddress !== ownerAddress) {
          throw new Error(`Transaction fee payer (${feePayerAddress}) does not match wallet address (${ownerAddress})`)
        }
      }
      transactionMessage = setTransactionMessageFeePayer(ownerAddress, transactionMessage)
    }
    // Check if it's a native transfer object {to, value}
    const fee = await this._getTransactionFee(transactionMessage)
    return { fee }
  }

  /**
   * Quotes the costs of a transfer operation.
   *
   * @param {TransferOptions} options - The transfer's options.
   * @returns {Promise<Omit<TransferResult, 'hash'>>} The transfer's quotes.
   */
  async quoteTransfer (options) {
    if (!this._rpc) {
      throw new Error('The wallet must be connected to a provider to quote transfer operations.')
    }

    const { token, recipient, amount } = options
    const transactionMessage = await this._buildSPLTransferTransactionMessage(token, recipient, amount)

    const fee = await this._getTransactionFee(transactionMessage)

    return { fee }
  }

  /**
   * Retrieves a transaction receipt by its signature
   *
   * @param {string} hash - The transaction's hash.
   * @returns {Promise<SolanaTransactionReceipt | null>} — The receipt, or null if the transaction has not been included in a block yet.
   */
  async getTransactionReceipt (hash) {
    if (!this._rpc) {
      throw new Error('The wallet must be connected to a provider to fetch transaction receipts.')
    }

    const transaction = await this._rpc.getTransaction(hash, {
      commitment: this._commitment,
      maxSupportedTransactionVersion: 0
    }).send()

    return transaction
  }

  /**
   * Builds a transaction message for SPL token transfer.
   * Creates instructions for ATA creation (if needed) and token transfer.
   *
   * @protected
   * @param {string} token - The SPL token mint address (base58-encoded public key).
   * @param {string} recipient - The recipient's wallet address (base58-encoded public key).
   * @param {number | bigint} amount - The amount to transfer in token's base units (must be ≤ 2^64-1).
   * @returns {Promise<TransactionMessage>} The constructed transaction message.
   * @todo Support Token-2022 (Token Extensions Program).
   * @todo Support transfer with memo for tokens that require it.
   */
  async _buildSPLTransferTransactionMessage (token, recipient, amount) {
    if (typeof amount === 'bigint' && amount > 0xFFFFFFFFFFFFFFFFn) {
      throw new Error('Amount exceeds u64 maximum value')
    }
    if (typeof amount === 'number' && amount > Number.MAX_SAFE_INTEGER) {
      throw new Error('Amount exceeds safe integer range')
    }

    const addr = await this.getAddress()
    const ownerPublicKey = address(addr)
    const tokenMint = address(token)
    const recipientPublicKey = address(recipient)

    // Get associated token addresses
    const [fromATA] = await findAssociatedTokenPda({
      mint: tokenMint,
      owner: ownerPublicKey,
      tokenProgram: TOKEN_PROGRAM_ADDRESS
    })

    const [toATA] = await findAssociatedTokenPda({
      mint: tokenMint,
      owner: recipientPublicKey,
      tokenProgram: TOKEN_PROGRAM_ADDRESS
    })

    const instructions = []

    const recipientATAInfo = await this._rpc.getAccountInfo(toATA, { commitment: this._commitment, encoding: 'base64' }).send()

    // If recipient's ATA doesn't exist, add creation instruction (idempotent)
    if (!recipientATAInfo.value) {
      const createATAInstruction = getCreateAssociatedTokenIdempotentInstruction({
        ata: toATA,
        mint: tokenMint,
        owner: recipientPublicKey,
        payer: ownerPublicKey
      })
      instructions.push(createATAInstruction)
    }

    // Add transfer instruction
    const transferInstruction = getTransferInstruction({
      source: fromATA,
      mint: tokenMint,
      destination: toATA,
      authority: ownerPublicKey,
      amount: BigInt(amount)
    })

    instructions.push(transferInstruction)

    // Get latest blockhash
    const { value: latestBlockhash } = await this._rpc.getLatestBlockhash({ commitment: this._commitment }).send()

    // Build transaction message using pipe
    const transactionMessage = pipe(
      createTransactionMessage({ version: 0 }),
      tx => setTransactionMessageFeePayer(ownerPublicKey, tx),
      tx => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
      tx => appendTransactionMessageInstructions(instructions, tx)
    )

    return transactionMessage
  }

  /**
   * Builds a transaction message for native SOL transfer.
   * Creates a transfer instruction for sending SOL.
   *
   * @protected
   * @param {string} to - The recipient's address.
   * @param {number | bigint} value - The amount of SOL to send (in lamports).
   * @returns {Promise<TransactionMessage>} The constructed transaction message.
   */
  async _buildNativeTransferTransactionMessage (to, value) {
    const addr = await this.getAddress()
    const fromPublicKey = address(addr)
    const toPublicKey = address(to)

    // Create transfer instruction
    const transferInstruction = getTransferSolInstruction({
      source: { address: fromPublicKey },
      destination: toPublicKey,
      amount: BigInt(value)
    })

    // Get latest blockhash
    const { value: latestBlockhash } = await this._rpc.getLatestBlockhash({ commitment: this._commitment }).send()

    // Build transaction message using pipe
    const transactionMessage = pipe(
      createTransactionMessage({ version: 0 }),
      tx => setTransactionMessageFeePayer(fromPublicKey, tx),
      tx => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
      tx => appendTransactionMessageInstruction(transferInstruction, tx)
    )

    return transactionMessage
  }

  /**
   * Calculates the fee for a given transaction message.
   *
   * @protected
   * @param {TransactionMessage} transactionMessage - The transaction message to calculate fee for.
   * @returns {Promise<bigint>} The calculated transaction fee in lamports.
   */
  async _getTransactionFee (transactionMessage) {
    const compiledTransactionMessageEncoder = getCompiledTransactionMessageEncoder()
    const base64Decoder = getBase64Decoder()

    const base64EncodedMessage = pipe(
      transactionMessage,
      compileTransactionMessage,
      compiledTransactionMessageEncoder.encode,
      base64Decoder.decode
    )

    const fee = await this._rpc.getFeeForMessage(base64EncodedMessage, {
      commitment: this._commitment
    }).send()
    if (!fee.value) {
      throw new Error('Failed to calculate transaction fee')
    }
    return BigInt(fee.value)
  }
}
