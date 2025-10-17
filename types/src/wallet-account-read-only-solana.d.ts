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
    constructor(address: string, config?: Omit<SolanaWalletConfig, "transferMaxFee">);
    /**
     * The read-only wallet account configuration.
     *
     * @protected
     * @type {Omit<SolanaWalletConfig, 'transferMaxFee'>}
     */
    protected _config: Omit<SolanaWalletConfig, "transferMaxFee">;
    /**
     * A connection to a full node json rpc endpoint.
     *
     * @protected
     * @type {Connection}
     */
    protected _connection: Connection;
    /**
     * Quotes the costs of a send transaction operation.
     *
     * @param {SolanaTransaction} tx - The transaction.
     * @returns {Promise<{fee: bigint}>} Object containing the estimated transaction fee in lamports.
     */
    quoteSendTransaction(tx: SolanaTransaction): Promise<{
        fee: bigint;
    }>;
    /**
     * Returns a transaction's receipt.
     *
     * @param {string} hash - The transaction's hash.
     * @returns {Promise<SolanaTransactionReceipt>} – The receipt, or null if the transaction has not been included in a block yet.
     */
    getTransactionReceipt(hash: string): Promise<SolanaTransactionReceipt>;
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
    private _buildSPLTransferTransaction;
    /**
   * Builds a transaction for native SOL transfer.
   * Creates a transfer instruction for sending SOL.
   *
   * @private
   * @param {string} to - The recipient's address.
   * @param {number | bigint} value - The amount of SOL to send (in lamports).
   * @returns {Promise<Transaction>} The constructed transaction ready for signing or fee calculation.
   */
    private _buildNativeTransferTransaction;
}
export type SolanaRpc = ReturnType<typeof import("@solana/rpc").createSolanaRpc>;
export type SolanaTransactionReceipt = ReturnType<import("@solana/rpc-api").SolanaRpcApi["getTransaction"]>;
export type TransactionMessage = import("@solana/transaction-messages").TransactionMessage;
export type TransactionResult = import("@tetherto/wdk-wallet").TransactionResult;
export type TransferOptions = import("@tetherto/wdk-wallet").TransferOptions;
export type TransferResult = import("@tetherto/wdk-wallet").TransferResult;
export type TransferNativeTransaction = {
    /**
     * - The transaction's recipient address.
     */
    to: string;
    /**
     * - The amount of SOL to send (in lamports).
     *
     * Note: This type is defined to match the interface from
     */
    value: number | bigint;
};
/**
 * Union type that accepts TransferNativeTransaction, legacy Solana transactions, or versioned transactions.
 */
export type SolanaTransaction = TransferNativeTransaction | Transaction | VersionedTransaction;
export type SolanaWalletConfig = {
    /**
     * - The provider's rpc url.
     */
    rpcUrl?: string;
    /**
     * - The commitment level ('processed', 'confirmed', or 'finalized').
     */
    commitment?: string;
    /**
     * - The maximum fee amount for transfer operations.
     */
    transferMaxFee?: number | bigint;
};
import { WalletAccountReadOnly } from '@tetherto/wdk-wallet';
import { Connection } from '@solana/web3.js';
import { Transaction } from '@solana/web3.js';
import { VersionedTransaction } from '@solana/web3.js';
