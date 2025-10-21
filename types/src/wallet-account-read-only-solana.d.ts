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
     * The solana rpc client.
     *
     * @protected
     * @type {SolanaRpc}
     */
    protected _rpc: SolanaRpc;
    /**
     * A connection to a full node json rpc endpoint.
     *
     * @protected
     * @type {Connection}
     */
    protected _connection: Connection;
    /**
     * The solana rpc subscriptions websocket client.
     *
     * @protected
     * @type {SolanaRpcSubscriptions}
     */
    protected _rpcSubscriptions: SolanaRpcSubscriptions;
    /**
     * Returns the account's sol balance.
     *
     * @returns {Promise<bigint>} The sol balance (in lamports).
     */
    getBalance(): Promise<bigint>;
    /**
     * Returns the account balance for a specific token.
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
     * Returns a transaction's receipt.
     *
     * @param {string} hash - The transaction's hash.
     * @returns {Promise<SolanaTransactionReceipt | null>} – The receipt, or null if the transaction has not been included in a block yet.
     */
    getTransactionReceipt(hash: string): Promise<SolanaTransactionReceipt | null>;
    /**
     * Creates and returns a solana transaction message.
     *
     * @protected
     * @param {SolanaTransaction} tx - The transaction.
     * @returns {Promise<TransactionMessage>} The solana transaction message.
     */
    protected _getTransaction({ to, value }: SolanaTransaction): Promise<TransactionMessage>;
    /**
     * Creates and returns a solana web3.js transaction for the given token transfer.
     *
     * @protected
     * @param {TransferOptions} options - The transfer's options.
     * @returns {Promise<Transaction>} The solana web3.js transaction.
     */
    protected _getTransfer({ token, recipient, amount }: TransferOptions): Promise<Transaction>;
}
export type SolanaRpc = ReturnType<typeof createSolanaRpc>;
export type SolanaRpcSubscriptions = ReturnType<typeof createSolanaRpcSubscriptions>;
export type SolanaTransactionReceipt = ReturnType<import("@solana/rpc-api").SolanaRpcApi["getTransaction"]>;
export type TransactionMessage = import("@solana/transaction-messages").TransactionMessage;
export type TransactionResult = import("@tetherto/wdk-wallet").TransactionResult;
export type TransferOptions = import("@tetherto/wdk-wallet").TransferOptions;
export type TransferResult = import("@tetherto/wdk-wallet").TransferResult;
export type SolanaTransaction = {
    /**
     * - The transaction's recipient.
     */
    to: string;
    /**
     * - The amount of sols to send to the recipient (in lamports).
     */
    value: number | bigint;
};
export type SolanaWalletConfig = {
  /**
   * - The provider's rpc url.
   */
  provider?: string;
  /**
   * @deprecated Use 'provider' instead. The provider's rpc url.
   */
  rpcUrl?: string;
  /**
   * - The provider's websocket url. If not set, the rpc url will also be used for the websocket connection.
   */
  wsUrl?: string;
  /**
   * - The maximum fee amount for transfer operations.
   */
  transferMaxFee?: number | bigint;
};
import { WalletAccountReadOnly } from '@tetherto/wdk-wallet';
import { Connection, Transaction } from '@solana/web3.js';
import { createSolanaRpc, createSolanaRpcSubscriptions } from '@solana/kit';
