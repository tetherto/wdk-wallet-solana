export default class WalletAccountSolana {
    /**
     * Creates a new solana wallet account.
     *
     * @param {string|Uint8Array} seed - The wallet's [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) seed phrase or Uint8Array.
     * @param {string} path - The BIP-44 derivation path (e.g. "0'/0/0").
     * @param {SolanaWalletConfig} [config] - The configuration object.
     */
    static create(seed: string | Uint8Array, path: string, config?: SolanaWalletConfig): Promise<WalletAccountSolana>;
    constructor(seed: any, path: any, config?: {});
    /**
     * @private
     */
    private _rpc;
    /**
     * @private
     */
    private _rpcSubscriptions;
    /**
     * @private
     */
    private _path;
    /**
     * @private
     */
    private _config;
    /**
     * @private
     */
    private _connection;
    /**
     * @private
     */
    private _signer;
    /**
     * @private
     */
    private _seedBuffer;
    /**
     * @private
     */
    private _keypair;
    /**
     * @private
     */
    private _secretKeyBuffer;
    /**
     * @private
     */
    private _publicKeyBuffer;
    /**
     * @private
     */
    private _privateKeyBuffer;
    /**
     * Initializes the wallet account.
     * @private
     * @returns {Promise<void>}
     */
    private _initialize;
    /**
     * The derivation path's index of this account.
     *
     * @type {number}
     */
    get index(): number;
    /**
     * The derivation path of this account.
     *
     * @type {string}
     */
    get path(): string;
    /**
     * The account's key pair.
     *
     * @type {KeyPair}
     */
    get keyPair(): KeyPair;
    /**
     * Returns the account's address.
     *
     * @returns {Promise<string>} The account's address.
     */
    getAddress(): Promise<string>;
    /**
     * Signs a message.
     *
     * @param {string} message - The message to sign.
     * @returns {Promise<string>} The message's signature.
     */
    sign(message: string): Promise<string>;
    /**
     * Verifies a message's signature.
     *
     * @param {string} message - The original message.
     * @param {string} signature - The signature to verify.
     * @returns {Promise<boolean>} True if the signature is valid.
     */
    verify(message: string, signature: string): Promise<boolean>;
    /**
     * Creates a transaction message for sending SOL or quoting fees.
     * @private
     * @param {SolanaTransaction} tx - The transaction details
     * @param {string} version - The transaction message version ('legacy' or 0)
     * @returns {Promise<Object>} The transaction message and instructions
     */
    private _createTransactionMessage;
    /**
     * Sends a transaction with arbitrary data.
     *
     * @param {SolanaTransaction} tx - The transaction to send.
     * @returns {Promise<string>} The transaction's hash.
     */
    sendTransaction(tx: SolanaTransaction): Promise<string>;
    /**
     * Quotes a transaction.
     *
     * @param {SolanaTransaction} tx - The transaction to quote.
     * @returns {Promise<number>} The transaction's fee (in lamports).
     */
    quoteSendTransaction(tx: SolanaTransaction): Promise<number>;
    /**
     * Returns the account's native token balance.
     *
     * @returns {Promise<number>} The native token balance in lamports.
     */
    getBalance(): Promise<number>;
    /**
     * Returns the account balance for a specific token.
     *
     * @param {string} tokenAddress - The smart contract address of the token.
     * @returns {Promise<number>} The token balance.
     */
    getTokenBalance(tokenAddress: string): Promise<number>;
    /**
     * Creates a transfer transaction.
     * @private
     * @param {TransferOptions} params - The transaction parameters.
     * @returns {Promise<Transaction>} The transfer transaction.
     */
    private _createTransfer;
    /**
     * Quotes a token transfer.
     *
     * @param {TransferOptions} params - The transaction parameters.
     * @returns {Promise<number>} The transaction's fee (in lamports).
     */
    quoteTransfer({ recipient, token, amount }: TransferOptions): Promise<number>;
    /**
     * Sends a token transaction.
     *
     * @param {TransferOptions} params - The transaction parameters.
     * @returns {Promise<string>} The transaction's hash.
     */
    transfer({ recipient, token, amount }: TransferOptions): Promise<string>;
    /**
     * Disposes of the wallet account.
     * @returns {void}
     */
    dispose(): void;
}
export type KeyPair = {
    /**
     * - The public key.
     */
    publicKey: string;
    /**
     * - The private key.
     */
    privateKey: string;
};
export type SolanaTransaction = {
    /**
     * - The transaction's recipient.
     */
    to: string;
    /**
     * - The amount of SOL to send to the recipient (in lamports).
     */
    value: number;
};
export type SolanaWalletConfig = {
    /**
     * - The rpc url of the provider.
     */
    rpcUrl?: string;
    /**
     * - The ws url of the provider is optional, if not provided, it will be derived from the rpc url.
     * Note: only use this if you want to use a custom ws url.
     */
    wsUrl?: string;
};
export type TransferOptions = {
    /**
     * - The recipient's address.
     */
    recipient: string;
    /**
     * - The token's address.
     */
    token: string;
    /**
     * - The amount of tokens to send.
     */
    amount: number;
};
