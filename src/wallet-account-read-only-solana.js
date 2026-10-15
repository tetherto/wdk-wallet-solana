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

import { WalletAccountReadOnly, NoSuchElementError, ProviderRequiredError, ValueError } from '@tetherto/wdk-wallet'

import FailoverProvider from '@tetherto/wdk-failover-provider'

import { address, getPublicKeyFromAddress } from '@solana/addresses'
import { createSolanaRpc } from '@solana/rpc'
import { pipe } from '@solana/functional'
import {
  createTransactionMessage,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstruction,
  appendTransactionMessageInstructions,
  getCompiledTransactionMessageEncoder,
  setTransactionMessageFeePayer,
  compileTransactionMessage,
  isTransactionMessageWithBlockhashLifetime,
  isTransactionMessageWithDurableNonceLifetime
} from '@solana/transaction-messages'
import { getTransactionDecoder, getTransactionMessageSize, getTransactionMessageSizeLimit } from '@solana/transactions'
import { getBase64Decoder, getBase64Encoder } from '@solana/codecs'
import { getTransferSolInstruction, SYSTEM_PROGRAM_ADDRESS } from '@solana-program/system'
import { getAddMemoInstruction, LEGACY_MEMO_PROGRAM_ADDRESS_V3 } from '@solana-program/memo'
import {
  ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstruction,
  getTokenSize,
  getTransferCheckedInstruction,
  TOKEN_PROGRAM_ADDRESS
} from '@solana-program/token'
import {
  AccountState,
  fetchMaybeToken,
  getMintDecoder as getMint2022Decoder,
  getTokenDecoder as getToken2022Decoder,
  getTokenSize as getToken2022Size,
  TOKEN_2022_PROGRAM_ADDRESS
} from '@solana-program/token-2022'

import {
  ConfidentialTransferNotSupportedError,
  FrozenTokenAccountError,
  NonTransferableTokenError,
  TransferHookNotSupportedError
} from './errors.js'
import { isSignature, verifySignature } from '@solana/keys'
import { createNoopSigner } from '@solana/signers'

/** @typedef {import('@tetherto/wdk-wallet').TransactionResult} TransactionResult */
/** @typedef {import('@tetherto/wdk-wallet').TransferOptions} TransferOptions */
/** @typedef {import('@tetherto/wdk-wallet').TransferResult} TransferResult */
/** @typedef {import('@tetherto/wdk-wallet').TransactionReceipt} TransactionReceipt */
/** @typedef {import('@tetherto/wdk-wallet').WaitForTransactionOptions} WaitForTransactionOptions */

/** @typedef {import('@solana-program/token-2022').Extension} Extension */
/** @typedef {import('@solana/transaction-messages').TransactionMessage} TransactionMessage */
/** @typedef {import('@solana/transactions').Transaction} Transaction */
/** @typedef {import('@solana/signers').TransactionSigner} TransactionSigner */
/** @typedef {ReturnType<typeof import('@solana/rpc').createSolanaRpc>} SolanaRpc */
/** @typedef {ReturnType<import('@solana/rpc-api').SolanaRpcApi['getTransaction']>} SolanaTransactionReceipt */
/** @typedef {import('@solana/rpc-types').Commitment} Commitment */

/**
 * The address of a token program this account transfers under: the SPL Token Program or the Token Extensions Program (Token-2022).
 *
 * @typedef {typeof TOKEN_PROGRAM_ADDRESS | typeof TOKEN_2022_PROGRAM_ADDRESS} TokenProgramAddress
 */

/**
 * The Solana-specific fields added to a normalized transaction receipt.
 *
 * @typedef {Object} SolanaTransactionDetails
 * @property {number | null} confirmations - The number of confirmations, or null once the transaction is finalized (or when the node no longer reports a count).
 * @property {SolanaTransactionReceipt | null} transaction - The native Solana transaction object, or null while the transaction is pending.
 */

/**
 * The Solana-specific options of a transfer operation, next to the chain-agnostic {@link TransferOptions}.
 *
 * @typedef {Object} SolanaTransferOptions
 * @property {string} [memo] - A UTF-8 memo to attach to the transfer, ignored when empty. It has to be short enough for the transfer to stay within the maximum transaction size. A Token-2022 recipient account enabling the memo transfer extension rejects transfers that carry none.
 */

/**
 * The Solana-specific costs of a transfer operation, next to the chain-agnostic network fee.
 *
 * @typedef {Object} SolanaTransferQuoteDetails
 * @property {bigint} rent - The rent-exempt deposit (in lamports) the sender pays to create the recipient's token account, or 0n if it already exists.
 * @property {bigint} transferFee - The fee (in the token's base units) the token program withholds from the transferred amount, or 0n if the mint charges none. The recipient receives the amount less this fee.
 */

/**
 * @typedef {Object} SimpleSolanaTransaction
 * @property {string} to - The recipient's Solana address.
 * @property {number | bigint} value - The amount of SOL to send in lamports (1 SOL = 1,000,000,000 lamports).
 */

/**
 * A transaction to operate on: a native transfer object, a transaction message, or a
 * base64-encoded serialized transaction (e.g. a swap or bridge payload built by an
 * external API).
 *
 * @typedef {SimpleSolanaTransaction | TransactionMessage | string} SolanaTransaction
 */

/**
 * @typedef {Object} SolanaWalletConfig
 * @property {string | SolanaRpc | (string | SolanaRpc)[]} [provider] - The Solana RPC url or an already-built Solana RPC client. It's also possible to provide an array of these instead. In such case, connection errors will cause the wallet to automatically fallback on the next provider in the list. An already-built client is reused as-is, which lets a manager share a single client across all the accounts it creates.
 * @property {string | string[]} [rpcUrl] - Deprecated alias for `provider`. If both are set, `provider` takes precedence.
 * @property {Commitment} [commitment] - The commitment level (default: 'confirmed').
 * @property {number} [retries] - If set and if 'provider' is a list of urls, the number of additional retry attempts after the initial call fails. Total attempts = `1 + retries`. For example, `retries: 3` with 4 providers will try each provider once before throwing. If `retries` exceeds the number of providers, the failover will loop back and retry already-failed providers in round-robin order (default: 3).
 * @property {number | bigint} [transferMaxFee] - Maximum allowed fee in lamports for transfer operations.
 * @property {number | bigint} [transactionMaxFee] - The maximum fee amount for sendTransaction and signTransaction operations.
 */

/**
 * A mint account, as fetched from the chain.
 *
 * @typedef {Object} MintAccount
 * @property {TokenProgramAddress} tokenProgram - The address of the token program owning the mint.
 * @property {number} decimals - The number of decimals of the token.
 * @property {Extension[]} extensions - The mint's Token-2022 extensions, or an empty list for a classic or bare mint.
 */

const MAX_U64 = 0xffffffffffffffffn

/** The maximum number of addresses the `getMultipleAccounts` RPC accepts per call. */
const MAX_ACCOUNTS_PER_REQUEST = 100

/** The number of basis points in a whole, the unit of a Token-2022 transfer fee rate. */
const BASIS_POINTS_PER_WHOLE = 10000n

/**
 * The account extensions the Token Extensions Program adds to every token account of a
 * mint carrying the given mint extension, sized with zeroed fields. The associated token
 * account program also adds `ImmutableOwner` to every account it creates.
 */
const REQUIRED_ACCOUNT_EXTENSIONS = {
  TransferFeeConfig: { __kind: 'TransferFeeAmount', withheldAmount: 0n },
  TransferHook: { __kind: 'TransferHookAccount', transferring: false },
  PausableConfig: { __kind: 'PausableAccount' }
}

/**
 * The mint extensions a transfer is refused for, each mapped to the error it raises.
 * An entry returns `null` when the extension is present but harmless in its current
 * configuration, such as a transfer hook with no hook program set. Every other extension,
 * including the transfer fee and interest-bearing ones, is transferred through unchanged.
 */
const REJECTED_MINT_EXTENSIONS = {
  NonTransferable: token =>
    new NonTransferableTokenError(`Token '${token}' is non-transferable.`),
  TransferHook: (token, extension) => extension.programId !== SYSTEM_PROGRAM_ADDRESS
    ? new TransferHookNotSupportedError(`Token '${token}' carries a transfer hook, which is not supported.`)
    : null,
  ConfidentialTransferMint: token =>
    new ConfidentialTransferNotSupportedError(`Token '${token}' is configured for confidential transfers, which are not supported.`)
}

/**
 * Read-only Solana wallet account implementation.
 */
export default class WalletAccountReadOnlySolana extends WalletAccountReadOnly {
  /**
   * Creates a new solana read-only wallet account.
   *
   * @param {string} addr - The account's address.
   * @param {Omit<SolanaWalletConfig, 'transferMaxFee' | 'transactionMaxFee'>} [config] - The configuration object.
   */
  constructor (addr, config = {}) {
    super(addr)

    /**
     * The read-only wallet account configuration.
     *
     * @protected
     * @type {Omit<SolanaWalletConfig, 'transferMaxFee' | 'transactionMaxFee'>}
     */
    this._config = config

    const { commitment = 'confirmed' } = config

    /**
     * The commitment level for querying transaction and account states.
     * Determines the level of finality required before returning results.
     *
     * @protected
     * @type {Commitment}
     */
    this._commitment = commitment

    /**
     * A Solana RPC client for HTTP requests.
     *
     * @protected
     * @type {SolanaRpc | undefined}
     */
    this._rpc = WalletAccountReadOnlySolana._buildRpc(config)

    /**
     * The token program owning each mint already fetched by this instance, keyed by mint
     * address. A Token-2022 mint can be closed and its address initialized again, so an entry
     * is only trusted while the account's token account exists under it; a balance read that
     * finds none fetches the mint again.
     *
     * @private
     * @type {Map<string, TokenProgramAddress>}
     */
    this._tokenProgramCache = new Map()
  }

  /**
   * Returns the account's native SOL balance.
   *
   * @returns {Promise<bigint>} The sol balance (in lamports).
   * @throws {ProviderRequiredError} If the wallet is not connected to a provider.
   */
  async getBalance () {
    if (!this._rpc) {
      throw new ProviderRequiredError('The wallet must be connected to a provider to retrieve balances.')
    }

    const addr = await this.getAddress()
    const balance = await this._rpc.getBalance(address(addr), { commitment: this._commitment }).send()

    return balance.value
  }

  /**
   * Returns the account balance for a specific token, held under either the SPL Token
   * Program or the Token Extensions Program (Token-2022).
   *
   * @param {string} tokenAddress - The smart contract address of the token.
   * @returns {Promise<bigint>} The token balance (in base unit).
   * @throws {ProviderRequiredError} If the wallet is not connected to a provider.
   */
  async getTokenBalance (tokenAddress) {
    if (!this._rpc) {
      throw new ProviderRequiredError('The wallet must be connected to a provider to retrieve token balances.')
    }

    const ownerAddress = await this.getAddress()
    const isCached = this._tokenProgramCache.has(tokenAddress)
    const tokenProgram = await this._resolveTokenProgram(tokenAddress)

    const amount = await this._fetchTokenAmount(ownerAddress, tokenAddress, tokenProgram)

    if (amount !== null || !isCached) {
      return amount ?? 0n
    }

    const { tokenProgram: currentTokenProgram } = await this._fetchMintAccount(tokenAddress)

    if (currentTokenProgram === tokenProgram) {
      return 0n
    }

    const currentAmount = await this._fetchTokenAmount(ownerAddress, tokenAddress, currentTokenProgram)

    return currentAmount ?? 0n
  }

  /**
   * Returns the account balances for a list of tokens, held under either the SPL Token
   * Program or the Token Extensions Program (Token-2022). The two may be mixed freely
   * within one call.
   *
   * @param {string[]} tokenAddresses - The smart contract addresses of the tokens.
   * @returns {Promise<Record<string, bigint>>} A mapping of token addresses to their balances (in base units).
   * @throws {ProviderRequiredError} If the wallet is not connected to a provider.
   */
  async getTokenBalances (tokenAddresses) {
    if (!this._rpc) {
      throw new ProviderRequiredError(
        'The wallet must be connected to a provider to retrieve token balances.'
      )
    }

    if (!tokenAddresses || tokenAddresses.length === 0) {
      return {}
    }

    const ownerAddress = await this.getAddress()

    const uniqueTokenAddresses = [...new Set(tokenAddresses)]
    const cachedTokenAddresses = uniqueTokenAddresses.filter(tokenAddress => this._tokenProgramCache.has(tokenAddress))
    const tokenPrograms = await this._resolveTokenPrograms(uniqueTokenAddresses)

    const amounts = await this._fetchTokenAmounts(ownerAddress, uniqueTokenAddresses, tokenPrograms)

    const unheldCachedTokenAddresses = cachedTokenAddresses.filter(tokenAddress => amounts[tokenAddress] === null)

    if (unheldCachedTokenAddresses.length > 0) {
      const mintAccounts = await this._fetchMintAccounts(unheldCachedTokenAddresses)

      const movedTokenAddresses = unheldCachedTokenAddresses
        .filter(tokenAddress => mintAccounts[tokenAddress].tokenProgram !== tokenPrograms[tokenAddress])

      if (movedTokenAddresses.length > 0) {
        const currentTokenPrograms = Object.fromEntries(
          movedTokenAddresses.map(tokenAddress => [tokenAddress, mintAccounts[tokenAddress].tokenProgram])
        )

        Object.assign(amounts, await this._fetchTokenAmounts(ownerAddress, movedTokenAddresses, currentTokenPrograms))
      }
    }

    const balances = {}
    for (const tokenAddress of uniqueTokenAddresses) {
      balances[tokenAddress] = amounts[tokenAddress] ?? 0n
    }

    return balances
  }

  /**
   * Quotes the costs of a send transaction operation.
   *
   * @param {SolanaTransaction} tx - The transaction: a native transfer object, a transaction
   *   message, or a base64-encoded serialized transaction.
   * @returns {Promise<Omit<TransactionResult, 'hash'>>} The transaction's quotes.
   * @throws {ProviderRequiredError} If the wallet is not connected to a provider.
   */
  async quoteSendTransaction (tx) {
    if (!this._rpc) {
      throw new ProviderRequiredError('The wallet must be connected to a provider to quote transactions.')
    }

    if (typeof tx === 'string') {
      const { messageBytes } = this._decodeSerializedTransaction(tx)
      const base64EncodedMessage = getBase64Decoder().decode(messageBytes)

      const fee = await this._getFeeForBase64Message(base64EncodedMessage)

      return { fee }
    }

    const ownerAddress = await this.getAddress()

    let transactionMessage = tx

    if (tx.to !== undefined && tx.value !== undefined) {
      transactionMessage = await this._buildNativeTransferTransactionMessage(tx.to, tx.value)
    }

    if (Array.isArray(transactionMessage.instructions)) {
      transactionMessage = await this._ensureLifetime(transactionMessage)
      await this._assertFeePayer(transactionMessage)
      transactionMessage = setTransactionMessageFeePayer(address(ownerAddress), transactionMessage)
    }
    const fee = await this._getTransactionFee(transactionMessage)
    return { fee }
  }

  /**
   * Quotes the costs of a transfer operation.
   *
   * @param {TransferOptions} options - The transfer's options.
   * @param {SolanaTransferOptions} [solanaOptions] - The transfer's Solana-specific options.
   * @returns {Promise<Omit<TransferResult, 'hash'> & SolanaTransferQuoteDetails>} The transfer's quotes.
   * @throws {ProviderRequiredError} If the wallet is not connected to a provider.
   */
  async quoteTransfer (options, solanaOptions = {}) {
    if (!this._rpc) {
      throw new ProviderRequiredError('The wallet must be connected to a provider to quote transfer operations.')
    }

    const { token, recipient, amount } = options
    const transactionMessage = await this._buildSPLTransferTransactionMessage(token, recipient, amount, solanaOptions)

    const fee = await this._getTransactionFee(transactionMessage)

    const { tokenProgram, extensions: mintExtensions } = await this._fetchMintAccount(token)

    const createsRecipientAccount = transactionMessage.instructions
      .some(instruction => instruction.programAddress === ASSOCIATED_TOKEN_PROGRAM_ADDRESS)

    const rent = createsRecipientAccount ? await this._getTokenAccountRent(tokenProgram, mintExtensions) : 0n
    const transferFee = await this._getTransferFee(mintExtensions, amount)

    return { fee, rent, transferFee }
  }

  /**
   * Retrieves a transaction receipt by its signature
   *
   * @deprecated Use {@link getTransaction} instead, which returns a normalized, finality-based receipt. The raw transaction remains available on its `transaction` property.
   * @param {string} hash - The transaction's hash.
   * @returns {Promise<SolanaTransactionReceipt | null>} The receipt, or null if the transaction has not been included in a block yet.
   * @throws {ProviderRequiredError} If the wallet is not connected to a provider.
   * @throws {ValueError} If the hash is not a valid signature.
   */
  async getTransactionReceipt (hash) {
    if (!this._rpc) {
      throw new ProviderRequiredError('The wallet must be connected to a provider to fetch transaction receipts.')
    }
    if (!isSignature(hash)) {
      throw new ValueError('Invalid signature.')
    }

    const transaction = await this._rpc
      .getTransaction(hash, {
        commitment: this._commitment,
        maxSupportedTransactionVersion: 0,
        encoding: 'json'
      })
      .send()

    return transaction
  }

  /**
   * Returns a normalized, finality-based receipt for a transaction.
   *
   * @param {string} hash - The transaction's signature.
   * @returns {Promise<TransactionReceipt & SolanaTransactionDetails>} The normalized receipt.
   * @throws {ProviderRequiredError} If the wallet is not connected to a provider.
   * @throws {ValueError} If the hash is not a valid signature.
   * @throws {NoSuchElementError} If no transaction has been found for the given hash.
   */
  async getTransaction (hash) {
    if (!this._rpc) {
      throw new ProviderRequiredError('The wallet must be connected to a provider to fetch transactions.')
    }
    if (!isSignature(hash)) {
      throw new ValueError('Invalid signature.')
    }

    const { value: [status] } = await this._rpc
      .getSignatureStatuses([hash], { searchTransactionHistory: true })
      .send()

    if (!status) {
      throw new NoSuchElementError(`No transaction found for '${hash}'.`)
    }

    const settled = status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized'
    const finality = status.confirmationStatus === 'finalized'
      ? 'final'
      : settled ? 'confirmed' : 'pending'

    const transaction = settled
      ? await this._rpc
        .getTransaction(hash, {
          commitment: this._commitment,
          maxSupportedTransactionVersion: 0,
          encoding: 'json'
        })
        .send()
      : null

    return {
      hash,
      finality,
      success: settled ? status.err === null : undefined,
      block: Number(status.slot),
      fee: transaction?.meta ? BigInt(transaction.meta.fee) : undefined,
      confirmations: status.confirmations == null ? null : Number(status.confirmations),
      transaction
    }
  }

  /**
   * Blocks until a transaction reaches the requested finality target, or times out.
   *
   * Note: Solana RPC does not expose a `dropped` state. An evicted or never-landed
   * signature simply reports no status, which is indistinguishable from a not-yet-seen
   * transaction and is treated as still-pending. A dropped transaction therefore surfaces
   * as a {@link TimeoutError} rather than resolving to a `dropped` receipt.
   *
   * @param {string} hash - The transaction's signature.
   * @param {WaitForTransactionOptions} [options] - The wait options.
   * @returns {Promise<TransactionReceipt & SolanaTransactionDetails>} The terminal receipt for the finality target reached (inspect `success` to tell success from revert).
   * @throws {TimeoutError} If the target is not reached before the timeout.
   */
  async waitForTransaction (hash, options = {}) {
    return await super.waitForTransaction(hash, options)
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

    const addr = await this.getAddress()
    const publicKey = await getPublicKeyFromAddress(address(addr))

    const isValid = await verifySignature(publicKey, signatureBytes, messageBytes)

    return isValid
  }

  /**
   * Builds a Solana RPC client from the wallet configuration: a url string, an already-built
   * client reused as-is, or a list of either (with connection errors failing over to the next).
   *
   * @protected
   * @param {Omit<SolanaWalletConfig, 'transferMaxFee' | 'transactionMaxFee'>} [config] - The configuration object.
   * @returns {SolanaRpc | undefined} The rpc client, or undefined if none is configured.
   */
  static _buildRpc (config = {}) {
    const { provider, rpcUrl, retries = 3 } = config
    const rpcTarget = provider ?? rpcUrl

    const toOption = (entry) => (typeof entry === 'string' ? createSolanaRpc(entry) : entry)

    if (Array.isArray(rpcTarget)) {
      if (rpcTarget.length === 0) {
        return undefined
      }

      const failoverProvider = new FailoverProvider({ retries })

      for (const entry of rpcTarget) {
        failoverProvider.addProvider(toOption(entry))
      }

      return failoverProvider.initialize()
    }

    if (rpcTarget) {
      return toOption(rpcTarget)
    }

    return undefined
  }

  /**
   * Resolves the token program owning a mint: either the classic SPL Token Program or
   * the Token Extensions Program (Token-2022).
   *
   * @protected
   * @param {string} mintAddress - The mint's address (base58-encoded public key).
   * @returns {Promise<TokenProgramAddress>} The address of the owning token program.
   */
  async _resolveTokenProgram (mintAddress) {
    const tokenPrograms = await this._resolveTokenPrograms([mintAddress])

    return tokenPrograms[mintAddress]
  }

  /**
   * Resolves the token program owning each of the given mints, from the cache when known,
   * fetching the other mints in as few RPC calls as the `getMultipleAccounts` limit allows.
   *
   * @protected
   * @param {string[]} mintAddresses - The mints' addresses (base58-encoded public keys).
   * @returns {Promise<Record<string, TokenProgramAddress>>} A mapping of mint addresses to the addresses of their owning token programs.
   */
  async _resolveTokenPrograms (mintAddresses) {
    const uniqueMintAddresses = [...new Set(mintAddresses)]
    const missingMintAddresses = uniqueMintAddresses.filter(mintAddress => !this._tokenProgramCache.has(mintAddress))

    if (missingMintAddresses.length > 0) {
      await this._fetchMintAccounts(missingMintAddresses)
    }

    const tokenPrograms = {}
    for (const mintAddress of uniqueMintAddresses) {
      tokenPrograms[mintAddress] = this._tokenProgramCache.get(mintAddress)
    }

    return tokenPrograms
  }

  /**
   * Fetches the mint account at the given address from the chain.
   *
   * @protected
   * @param {string} mintAddress - The mint's address (base58-encoded public key).
   * @returns {Promise<MintAccount>} The mint account.
   */
  async _fetchMintAccount (mintAddress) {
    const mintAccounts = await this._fetchMintAccounts([mintAddress])

    return mintAccounts[mintAddress]
  }

  /**
   * Fetches the mint accounts at the given addresses from the chain, batching them within
   * the `getMultipleAccounts` limit, and caches their token program.
   *
   * @protected
   * @param {string[]} mintAddresses - The mints' addresses (base58-encoded public keys).
   * @returns {Promise<Record<string, MintAccount>>} A mapping of mint addresses to their mint accounts.
   * @throws {ProviderRequiredError} If the wallet is not connected to a provider.
   * @throws {NoSuchElementError} If no account exists at one of the given addresses.
   * @throws {ValueError} If one of the accounts is not a mint owned by a supported token program.
   */
  async _fetchMintAccounts (mintAddresses) {
    if (!this._rpc) {
      throw new ProviderRequiredError('The wallet must be connected to a provider to resolve token programs.')
    }

    const uniqueMintAddresses = [...new Set(mintAddresses)]
    const mintAccounts = {}

    for (let offset = 0; offset < uniqueMintAddresses.length; offset += MAX_ACCOUNTS_PER_REQUEST) {
      const batchMintAddresses = uniqueMintAddresses.slice(offset, offset + MAX_ACCOUNTS_PER_REQUEST)

      const { value: accounts } = await this._rpc
        .getMultipleAccounts(batchMintAddresses.map(mintAddress => address(mintAddress)), {
          commitment: this._commitment,
          encoding: 'base64'
        })
        .send()

      for (let i = 0; i < batchMintAddresses.length; i++) {
        const mintAddress = batchMintAddresses[i]
        const account = accounts[i]

        if (!account) {
          throw new NoSuchElementError(`No mint account found for '${mintAddress}'.`)
        }

        const tokenProgram = account.owner

        if (tokenProgram !== TOKEN_PROGRAM_ADDRESS && tokenProgram !== TOKEN_2022_PROGRAM_ADDRESS) {
          throw new ValueError(`'${mintAddress}' is not owned by a supported token program.`)
        }

        let mint

        try {
          mint = getMint2022Decoder().decode(getBase64Encoder().encode(account.data[0]))
        } catch {
          throw new ValueError(`'${mintAddress}' is not a mint account.`)
        }

        const { decimals, extensions } = mint

        this._tokenProgramCache.set(mintAddress, tokenProgram)

        mintAccounts[mintAddress] = {
          tokenProgram,
          decimals,
          extensions: extensions.__option === 'Some' ? extensions.value : []
        }
      }
    }

    return mintAccounts
  }

  /**
   * Returns the rent-exempt deposit for a new associated token account of a mint.
   *
   * @protected
   * @param {TokenProgramAddress} tokenProgram - The address of the token program owning the mint.
   * @param {Extension[]} mintExtensions - The mint's extensions.
   * @returns {Promise<bigint>} The rent-exempt deposit (in lamports).
   */
  async _getTokenAccountRent (tokenProgram, mintExtensions) {
    let size = getTokenSize()

    if (tokenProgram === TOKEN_2022_PROGRAM_ADDRESS) {
      const accountExtensions = mintExtensions
        .map(extension => REQUIRED_ACCOUNT_EXTENSIONS[extension.__kind])
        .filter(Boolean)

      size = getToken2022Size([{ __kind: 'ImmutableOwner' }, ...accountExtensions])
    }

    return await this._rpc
      .getMinimumBalanceForRentExemption(BigInt(size), { commitment: this._commitment })
      .send()
  }

  /**
   * Returns the fee the Token Extensions Program withholds from a transfer of the given
   * amount, at the rate in force in the current epoch.
   *
   * @protected
   * @param {Extension[]} mintExtensions - The mint's extensions.
   * @param {number | bigint} amount - The amount to transfer in token's base units.
   * @returns {Promise<bigint>} The fee (in the token's base units), or 0n if the mint charges none.
   */
  async _getTransferFee (mintExtensions, amount) {
    const transferFeeConfig = mintExtensions.find(extension => extension.__kind === 'TransferFeeConfig')

    if (!transferFeeConfig) {
      return 0n
    }

    const { olderTransferFee, newerTransferFee } = transferFeeConfig
    const { epoch } = await this._rpc.getEpochInfo({ commitment: this._commitment }).send()

    const { transferFeeBasisPoints, maximumFee } = epoch >= newerTransferFee.epoch ? newerTransferFee : olderTransferFee

    // Rounded up, as the token program does, then capped at the mint's maximum fee.
    const rawFee = (BigInt(amount) * BigInt(transferFeeBasisPoints) + BASIS_POINTS_PER_WHOLE - 1n) / BASIS_POINTS_PER_WHOLE

    return rawFee < maximumFee ? rawFee : maximumFee
  }

  /**
   * Builds a transaction message for a token transfer, under either the SPL Token Program
   * or the Token Extensions Program (Token-2022). Creates instructions for ATA creation
   * (if needed) and token transfer.
   *
   * @protected
   * @param {string} token - The token mint address (base58-encoded public key).
   * @param {string} recipient - The recipient's wallet address (base58-encoded public key).
   * @param {number | bigint} amount - The amount to transfer in token's base units (must be ≤ 2^64-1).
   * @param {SolanaTransferOptions} [solanaOptions] - The transfer's Solana-specific options.
   * @returns {Promise<TransactionMessage>} The constructed transaction message.
   * @throws {ValueError} If the amount exceeds the representable range, if the memo is not a string, or if the memo makes the transaction exceed the maximum transaction size.
   * @throws {NonTransferableTokenError} If the mint is non-transferable.
   * @throws {TransferHookNotSupportedError} If the mint carries a transfer hook with a hook program set.
   * @throws {ConfidentialTransferNotSupportedError} If the mint is configured for confidential transfers.
   * @throws {FrozenTokenAccountError} If the recipient has no token account yet and the mint freezes by default the accounts it creates, or if the recipient's Token-2022 account is frozen.
   */
  async _buildSPLTransferTransactionMessage (token, recipient, amount, solanaOptions = {}) {
    const { memo } = solanaOptions ?? {}

    if (typeof amount === 'bigint' && amount > MAX_U64) {
      throw new ValueError('Amount exceeds u64 maximum value')
    }
    if (typeof amount === 'number' && amount > Number.MAX_SAFE_INTEGER) {
      throw new ValueError('Amount exceeds safe integer range')
    }
    // The memo is encoded as UTF-8, and the encoder stringifies whatever it is given, so a
    // non-string would be written to the chain as its string form rather than rejected.
    if (memo !== undefined && typeof memo !== 'string') {
      throw new ValueError('Memo must be a string')
    }

    const addr = await this.getAddress()
    const ownerPublicKey = address(addr)
    const tokenMint = address(token)
    const recipientPublicKey = address(recipient)

    const { tokenProgram, decimals, extensions: mintExtensions } = await this._fetchMintAccount(token)
    const isToken2022 = tokenProgram === TOKEN_2022_PROGRAM_ADDRESS

    for (const extension of mintExtensions) {
      const rejection = REJECTED_MINT_EXTENSIONS[extension.__kind]
      const error = rejection && rejection(token, extension)

      if (error) {
        throw error
      }
    }

    const [fromATA] = await findAssociatedTokenPda({
      mint: tokenMint,
      owner: ownerPublicKey,
      tokenProgram
    })

    const [toATA] = await findAssociatedTokenPda({
      mint: tokenMint,
      owner: recipientPublicKey,
      tokenProgram
    })

    const instructions = []

    const recipientTokenAccount = await fetchMaybeToken(this._rpc, toATA, { commitment: this._commitment })

    if (recipientTokenAccount.exists && isToken2022 && recipientTokenAccount.data.state === AccountState.Frozen) {
      throw new FrozenTokenAccountError(`The token account of '${recipient}' is frozen.`)
    }

    if (!recipientTokenAccount.exists) {
      const defaultAccountState = mintExtensions.find(extension => extension.__kind === 'DefaultAccountState')

      if (defaultAccountState?.state === AccountState.Frozen) {
        throw new FrozenTokenAccountError(`Token '${token}' freezes by default the accounts it creates, so '${recipient}' could not receive it.`)
      }

      const createATAInstruction = getCreateAssociatedTokenIdempotentInstruction({
        ata: toATA,
        mint: tokenMint,
        owner: recipientPublicKey,
        payer: await this._getTransactionSigner(),
        tokenProgram
      })
      instructions.push(createATAInstruction)
    }

    // The memo has to be logged before the transfer it refers to, since the memo
    // transfer extension only looks at the instructions preceding the transfer.
    if (memo) {
      instructions.push(getAddMemoInstruction({ memo }, { programAddress: LEGACY_MEMO_PROGRAM_ADDRESS_V3 }))
    }

    const transferInstruction = getTransferCheckedInstruction({
      source: fromATA,
      mint: tokenMint,
      destination: toATA,
      authority: ownerPublicKey,
      amount: BigInt(amount),
      decimals
    }, { programAddress: tokenProgram })

    instructions.push(transferInstruction)

    const { value: latestBlockhash } = await this._rpc.getLatestBlockhash({ commitment: this._commitment }).send()

    const transactionMessage = pipe(
      createTransactionMessage({ version: 0 }),
      (tx) => setTransactionMessageFeePayer(ownerPublicKey, tx),
      (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
      (tx) => appendTransactionMessageInstructions(instructions, tx)
    )

    // The memo is the only caller-sized part of the message, so an oversized one is caught here
    // rather than by the provider, which would reject the transaction with an opaque error.
    const size = getTransactionMessageSize(transactionMessage)
    const sizeLimit = getTransactionMessageSizeLimit(transactionMessage)

    if (size > sizeLimit) {
      throw new ValueError(`The transfer transaction is ${size} bytes, over the ${sizeLimit} bytes limit. Shorten the memo.`)
    }

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

    const transferInstruction = getTransferSolInstruction({
      source: await this._getTransactionSigner(),
      destination: toPublicKey,
      amount: BigInt(value)
    })

    const { value: latestBlockhash } = await this._rpc.getLatestBlockhash({ commitment: this._commitment }).send()

    const transactionMessage = pipe(
      createTransactionMessage({ version: 0 }),
      (tx) => setTransactionMessageFeePayer(fromPublicKey, tx),
      (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
      (tx) => appendTransactionMessageInstruction(transferInstruction, tx)
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

    return await this._getFeeForBase64Message(base64EncodedMessage)
  }

  /**
   * Queries the RPC for the fee of a base64-encoded, compiled transaction message.
   *
   * @protected
   * @param {string} base64EncodedMessage - The base64-encoded compiled transaction message.
   * @returns {Promise<bigint>} The calculated transaction fee in lamports.
   * @throws {ValueError} If the provider cannot compute a fee for the message, e.g. because its blockhash has expired.
   */
  async _getFeeForBase64Message (base64EncodedMessage) {
    const fee = await this._rpc
      .getFeeForMessage(base64EncodedMessage, {
        commitment: this._commitment
      })
      .send()
    if (!fee.value) {
      throw new ValueError('Failed to calculate transaction fee')
    }
    return BigInt(fee.value)
  }

  /**
   * Decodes a base64-encoded serialized transaction.
   *
   * @protected
   * @param {string} serializedTransaction - The base64-encoded serialized transaction.
   * @returns {Transaction} The decoded transaction.
   */
  _decodeSerializedTransaction (serializedTransaction) {
    const bytes = getBase64Encoder().encode(serializedTransaction)

    return getTransactionDecoder().decode(bytes)
  }

  /**
   * Ensures the transaction has either a blockhash lifetime or a durable nonce lifetime.
   *
   * @protected
   * @param {SolanaTransaction} tx - The transaction.
   * @returns {Promise<SolanaTransaction>} The transaction with lifetime.
   */
  async _ensureLifetime (tx) {
    if (
      !isTransactionMessageWithBlockhashLifetime(tx) &&
      !isTransactionMessageWithDurableNonceLifetime(tx)
    ) {
      const { value: latestBlockhash } = await this._rpc.getLatestBlockhash({ commitment: this._commitment }).send()
      return setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx)
    }

    return tx
  }

  /**
   * Asserts that any explicit transaction fee payer matches this wallet address.
   *
   * @protected
   * @param {SolanaTransaction} tx - The transaction.
   * @returns {Promise<void>} Resolves when the transaction has no explicit fee payer or it matches this wallet address.
   * @throws {ValueError} If the transaction fee payer does not match this wallet address.
   */
  async _assertFeePayer (tx) {
    if (tx.feePayer) {
      const ownerAddress = await this.getAddress()
      const feePayerAddress = typeof tx.feePayer === 'string' ? tx.feePayer : tx.feePayer.address
      if (feePayerAddress !== ownerAddress) {
        throw new ValueError(`Transaction fee payer (${feePayerAddress}) does not match wallet address (${ownerAddress})`)
      }
    }
  }

  /**
   * Returns the signer the instructions requiring this account's signature are built with.
   * A read-only account cannot sign, so it returns a no-op signer, which is enough to build
   * and quote a transaction.
   *
   * @protected
   * @returns {Promise<TransactionSigner>} The signer.
   */
  async _getTransactionSigner () {
    const addr = await this.getAddress()

    return createNoopSigner(address(addr))
  }

  /**
   * Reads the amount held by an owner in its associated token account of a mint, derived
   * under the given token program.
   *
   * @private
   * @param {string} ownerAddress - The owner's address (base58-encoded public key).
   * @param {string} tokenAddress - The mint's address (base58-encoded public key).
   * @param {TokenProgramAddress} tokenProgram - The token program to derive the account under.
   * @returns {Promise<bigint | null>} The amount held, or null if the token account does not exist.
   */
  async _fetchTokenAmount (ownerAddress, tokenAddress, tokenProgram) {
    const [ata] = await findAssociatedTokenPda({
      mint: address(tokenAddress),
      owner: address(ownerAddress),
      tokenProgram
    })

    const tokenAccount = await fetchMaybeToken(this._rpc, ata, { commitment: this._commitment })

    return tokenAccount.exists ? tokenAccount.data.amount : null
  }

  /**
   * Reads the amounts held by an owner in its associated token accounts of the given mints,
   * each derived under the given token program, batching them within the
   * `getMultipleAccounts` limit.
   *
   * @private
   * @param {string} ownerAddress - The owner's address (base58-encoded public key).
   * @param {string[]} tokenAddresses - The mints' addresses (base58-encoded public keys), without duplicates.
   * @param {Record<string, TokenProgramAddress>} tokenPrograms - A mapping of mint addresses to the token programs to derive the accounts under.
   * @returns {Promise<Record<string, bigint | null>>} A mapping of mint addresses to the amounts held, or null where the token account does not exist.
   */
  async _fetchTokenAmounts (ownerAddress, tokenAddresses, tokenPrograms) {
    const atas = await Promise.all(
      tokenAddresses.map(tokenAddress =>
        findAssociatedTokenPda({
          mint: address(tokenAddress),
          owner: address(ownerAddress),
          tokenProgram: tokenPrograms[tokenAddress]
        }).then(([ata]) => ata)
      )
    )

    const amounts = {}

    for (let offset = 0; offset < atas.length; offset += MAX_ACCOUNTS_PER_REQUEST) {
      const batchAtas = atas.slice(offset, offset + MAX_ACCOUNTS_PER_REQUEST)
      const batchTokenAddresses = tokenAddresses.slice(offset, offset + MAX_ACCOUNTS_PER_REQUEST)

      const { value: accounts } = await this._rpc
        .getMultipleAccounts(batchAtas, {
          commitment: this._commitment,
          encoding: 'base64'
        })
        .send()

      for (let i = 0; i < batchTokenAddresses.length; i++) {
        const account = accounts[i]

        if (!account) {
          amounts[batchTokenAddresses[i]] = null
          continue
        }

        const data = getBase64Encoder().encode(account.data[0])
        const { amount } = getToken2022Decoder().decode(data)

        amounts[batchTokenAddresses[i]] = amount
      }
    }

    return amounts
  }
}
