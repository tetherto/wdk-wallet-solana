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

import { WalletAccountReadOnly } from '@wdk/wallet'

import {
  address as _address, createSolanaRpc, createSolanaRpcSubscriptions,
  createTransactionMessage, setTransactionMessageFeePayerSigner, setTransactionMessageLifetimeUsingBlockhash,
  compileTransactionMessage, getCompiledTransactionMessageEncoder, getBase64Decoder,
  pipe, appendTransactionMessageInstructions, lamports
} from '@solana/kit'

import { Connection, PublicKey, Transaction } from '@solana/web3.js'

import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'

import { getTransferSolInstruction } from '@solana-program/system'

/** @typedef {ReturnType<import("@solana/rpc").createSolanaRpc>} SolanaRpc */
/** @typedef {ReturnType<import("@solana/rpc-subscriptions").createSolanaRpcSubscriptions>} SolanaRpcSubscriptions */
/** @typedef {ReturnType<import("@solana/rpc-api").SolanaRpcApi['getTransaction']>} SolanaTransactionReceipt */

/** @typedef {import('@solana/transaction-messages').TransactionMessage} TransactionMessage */

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

export default class WalletAccountReadOnlySolana extends WalletAccountReadOnly {
  /**
   * Creates a new solana read-only wallet account.
   *
   * @param {string} [address] - The account's address.
   * @param {Omit<SolanaWalletConfig, 'transferMaxFee'>} [config] - The configuration object.
   */
  constructor (address, config = {}) {
    super(address)

    /**
     * The read-only wallet account configuration.
     *
     * @protected
     * @type {Omit<SolanaWalletConfig, 'transferMaxFee'>}
     */
    this._config = config

    const { rpcUrl, wsUrl } = config

    if (rpcUrl) {
      /**
       * The solana rpc client.
       *
       * @protected
       * @type {SolanaRpc}
       */
      this._rpc = createSolanaRpc(rpcUrl)

      /**
       * A connection to a full node json rpc endpoint.
       *
       * @protected
       * @type {Connection}
       */
      this._connection = new Connection(rpcUrl, 'processed')

      /**
       * The solana rpc subscriptions websocket client.
       *
       * @protected
       * @type {SolanaRpcSubscriptions}
       */
      this._rpcSubscriptions = createSolanaRpcSubscriptions(wsUrl || rpcUrl.replace('http', 'ws'))
    }
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

    const address = await this.getAddress()

    const ownerAddress = new PublicKey(address)
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
   * Quotes the costs of a send transaction operation.
   *
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
   * Creates and returns a solana transaction message.
   *
   * @protected
   * @param {SolanaTransaction} tx - The transaction.
   * @returns {Promise<TransactionMessage>} The solana transaction message.
   */
  async _getTransaction ({ to, value }) {
    const address = await this.getAddress()

    const { value: latestBlockhash } = await this._rpc.getLatestBlockhash()
      .send()

    const instruction = getTransferSolInstruction({
      source: { address: _address(address) },
      destination: _address(to),
      amount: lamports(BigInt(value))
    })

    const transaction = pipe(
      createTransactionMessage({ version: 0 }),
      (tx) => setTransactionMessageFeePayerSigner({ address: _address(address) }, tx),
      (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
      (tx) => appendTransactionMessageInstructions([instruction], tx)
    )

    return transaction
  }

  /**
   * Creates and returns a solana web3.js transaction for the given token transfer.
   *
   * @protected
   * @param {TransferOptions} options - The transfer's options.
   * @returns {Promise<Transaction>} The solana web3.js transaction.
   */
  async _getTransfer ({ token, recipient, amount }) {
    const address = await this.getAddress()

    const _address = new PublicKey(address)
    const _token = new PublicKey(token)
    const _recipient = new PublicKey(recipient)

    const client = new Token(this._connection, _token, TOKEN_PROGRAM_ID, { publicKey: _address })

    const fromTokenAccount = await client.getOrCreateAssociatedAccountInfo(_address)
    const toTokenAccount = await client.getOrCreateAssociatedAccountInfo(_recipient)

    const instruction = Token.createTransferInstruction(TOKEN_PROGRAM_ID, fromTokenAccount.address,
      toTokenAccount.address, _address, [], amount)

    const transaction = new Transaction().add(instruction)

    const { blockhash } = await this._connection.getLatestBlockhash()
    transaction.recentBlockhash = blockhash
    transaction.feePayer = _address

    return transaction
  }
}
