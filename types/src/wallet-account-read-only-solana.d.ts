/**
 * Read-only Solana wallet account implementation.
 */
export default class WalletAccountReadOnlySolana extends WalletAccountReadOnly {
    /**
     * Creates a new solana read-only wallet account.
     *
     * @param {string} addr - The account's address.
     * @param {Omit<SolanaWalletConfig, 'transferMaxFee'>} [config] - The configuration object.
     */
    constructor(addr: string, config?: Omit<SolanaWalletConfig, "transferMaxFee">);
    /**
     * The read-only wallet account configuration.
     *
     * @protected
     * @type {Omit<SolanaWalletConfig, 'transferMaxFee'>}
     */
    protected _config: Omit<SolanaWalletConfig, "transferMaxFee">;
    /**
     * A Solana RPC client for HTTP requests.
     *
     * @protected
     * @type {SolanaRpc | undefined}
     */
    protected _rpc: SolanaRpc | undefined;
    /**
     * The commitment level for querying transaction and account states.
     * Determines the level of finality required before returning results.
     *
     * @protected
     * @type {Commitment}
     */
    protected _commitment: Commitment;
    /**
     * Returns the account's native SOL balance.
     *
     * @returns {Promise<bigint>} The sol balance (in lamports).
     */
    getBalance(): Promise<bigint>;
    /**
     * Returns the account balance for a specific SPL token.
     *
     * @param {string} tokenAddress - The smart contract address of the token.
     * @returns {Promise<bigint>} The token balance (in base unit).
     */
    getTokenBalance(tokenAddress: string): Promise<bigint>;
    /**
     * Quotes the costs of a send transaction operation.
     *
     * @param {SolanaTransaction} tx - The transaction.
     * @returns {Promise<Omit<TransactionResult, 'hash'>>} The transaction's quotes.
     */
    quoteSendTransaction(tx: SolanaTransaction): Promise<Omit<TransactionResult, "hash">>;
    /**
     * Quotes the costs of a transfer operation.
     *
     * @param {TransferOptions} options - The transfer's options.
     * @returns {Promise<Omit<TransferResult, 'hash'>>} The transfer's quotes.
     */
    quoteTransfer(options: TransferOptions): Promise<Omit<TransferResult, "hash">>;
    /**
     * Retrieves a transaction receipt by its signature
     *
     * @param {string} hash - The transaction's hash.
     * @returns {Promise<SolanaTransactionReceipt | null>} — The receipt, or null if the transaction has not been included in a block yet.
     */
    getTransactionReceipt(hash: string): Promise<SolanaTransactionReceipt | null>;
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
    protected _buildSPLTransferTransactionMessage(token: string, recipient: string, amount: number | bigint): Promise<TransactionMessage>;
    /**
     * Builds a transaction message for native SOL transfer.
     * Creates a transfer instruction for sending SOL.
     *
     * @protected
     * @param {string} to - The recipient's address.
     * @param {number | bigint} value - The amount of SOL to send (in lamports).
     * @returns {Promise<TransactionMessage>} The constructed transaction message.
     */
    protected _buildNativeTransferTransactionMessage(to: string, value: number | bigint): Promise<TransactionMessage>;
    /**
     * Calculates the fee for a given transaction message.
     *
     * @protected
     * @param {TransactionMessage} transactionMessage - The transaction message to calculate fee for.
     * @returns {Promise<bigint>} The calculated transaction fee in lamports.
     */
    protected _getTransactionFee(transactionMessage: TransactionMessage): Promise<bigint>;
    /**
     * Verifies a message's signature.
     *
     * @param {string} message - The original message.
     * @param {string} signature - The signature to verify.
     * @returns {Promise<boolean>} True if the signature is valid.
     */
    verify(message: string, signature: string): Promise<boolean>;
    /**
     * Ensures the transaction has either a blockhash lifetime or a durable nonce lifetime.
     *
     * @protected
     * @param {SolanaTransaction} tx - The transaction.
     * @returns {Promise<SolanaTransaction>} The transaction with lifetime.
     */
    protected _ensureLifetime(tx: SolanaTransaction): Promise<SolanaTransaction>;
    /**
     * Asserts that any explicit transaction fee payer matches this wallet address.
     *
     * @protected
     * @param {SolanaTransaction} tx - The transaction.
     * @returns {Promise<void>} Resolves when the transaction has no explicit fee payer or it matches this wallet address.
     * @throws {Error} If the transaction fee payer does not match this wallet address.
     */
    protected _assertFeePayer(tx: SolanaTransaction): Promise<void>;
}
export type TransactionResult = import("@tetherto/wdk-wallet").TransactionResult;
export type TransferOptions = import("@tetherto/wdk-wallet").TransferOptions;
export type TransferResult = import("@tetherto/wdk-wallet").TransferResult;
export type TransactionMessage = import("@solana/transaction-messages").TransactionMessage;
export type SolanaRpc = ReturnType<typeof import("@solana/rpc").createSolanaRpc>;
export type SolanaTransactionReceipt = ReturnType<import("@solana/rpc-api").SolanaRpcApi["getTransaction"]>;
export type Commitment = import("@solana/rpc-types").Commitment;
export type SimpleSolanaTransaction = {
    /**
     * - The recipient's Solana address.
     */
    to: string;
    /**
     * - The amount of SOL to send in lamports (1 SOL = 1,000,000,000 lamports).
     */
    value: number | bigint;
};
export type SolanaTransaction = SimpleSolanaTransaction | TransactionMessage;
export type SolanaWalletConfig = {
    /**
     * - The provider's rpc url. If it's a list of urls, the provider failover strategy will be enabled.
     */
    rpcUrl?: string | string[];
    /**
     * - The commitment level (default: 'confirmed').
     */
    commitment?: Commitment;
    /**
     * - The number of retries in the failover mechanism.
     */
    retries?: number;
    /**
     * - Maximum allowed fee in lamports for transfer operations.
     */
    transferMaxFee?: number | bigint;
};
import { WalletAccountReadOnly } from "@tetherto/wdk-wallet";
