/** @implements {IWalletAccount<FullySignedTransaction>} */
export default class WalletAccountSolana extends WalletAccountReadOnlySolana implements IWalletAccount<FullySignedTransaction> {
    /**
     * Creates a new solana wallet account.
     *
     * @deprecated
     * @param {string | Uint8Array} seed - A [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) mnemonic seed phrase, or a raw BIP-32 master seed (16-64 bytes).
     * @param {string} path - The SLIP-0010 derivation path (e.g. "0'/0'/0'").
     * @param {SolanaWalletConfig} [config] - The configuration object.
     * @returns {Promise<WalletAccountSolana>} The wallet account.
     */
    static at(seed: string | Uint8Array, path: string, config?: SolanaWalletConfig): Promise<WalletAccountSolana>;
    /**
     * Creates a new solana wallet account from a raw private key. The account owns the signer it creates
     * and wipes it on {@link dispose}.
     *
     * @param {string | Uint8Array} privateKey - A 32-byte Ed25519 private key (hex string or bytes), or a 64-byte secret key (base58 string or bytes).
     * @param {SolanaWalletConfig} [config] - The configuration object.
     * @returns {WalletAccountSolana} The wallet account.
     */
    static fromPrivateKey(privateKey: string | Uint8Array, config?: SolanaWalletConfig): WalletAccountSolana;
    /**
     * Creates a new solana wallet account from a signer.
     *
     * @overload
     * @param {ISignerSolana} signer - The solana signer, derived to an account path.
     * @param {SolanaWalletConfig & SignerOptions} [config] - The configuration object.
     */
    constructor(signer: ISignerSolana, config?: SolanaWalletConfig & SignerOptions);
    /**
     * Creates a new solana wallet account from a seed.
     *
     * @overload
     * @param {string | Uint8Array} seed - A [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) mnemonic seed phrase, or a raw BIP-32 master seed (16-64 bytes).
     * @param {string} path - The SLIP-0010 derivation path (e.g. "0'/0'/0'").
     * @param {SolanaWalletConfig} [config] - The configuration object.
     * @throws {ValueError} If the seed phrase is not a valid BIP-39 seed phrase.
     */
    constructor(seed: string | Uint8Array, path: string, config?: SolanaWalletConfig);
    /**
     * Creates the first solana wallet account (m/44'/501'/0'/0') from a seed.
     *
     * @overload
     * @param {string | Uint8Array} seed - A [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) mnemonic seed phrase, or a raw BIP-32 master seed (16-64 bytes).
     * @param {SolanaWalletConfig} [config] - The configuration object.
     * @throws {ValueError} If the seed phrase is not a valid BIP-39 seed phrase.
     */
    constructor(seed: string | Uint8Array, config?: SolanaWalletConfig);
    /**
     * The wallet account configuration.
     *
     * @protected
     * @type {SolanaWalletConfig}
     */
    protected _config: SolanaWalletConfig;
    /**
     * The solana signer.
     *
     * @private
     * @type {ISignerSolana}
     */
    private _signer;
    /**
     * If true, disposes the signer on calls to the 'dispose' method.
     *
     * @protected
     * @type {boolean}
     */
    protected _shouldWipeSignerOnDisposal: boolean;
    /**
     * @private
     */
    private _disposed;
    /**
     * True if the wallet account has been disposed.
     *
     * @type {boolean}
     */
    get disposed(): boolean;
    /**
     * The derivation path of this account, or null for an account backed by a non-HD signer.
     *
     * @type {string | null}
     */
    get path(): string | null;
    /**
     * The account's key pair.
     *
     * The uint8 arrays are the signer's own, so any external change will reflect to the signer's internal representation. For this reason,
     * it's strongly recommended to treat the key pair as a read-only view of the keys. While it's still technically possible to alter their
     * content, client code should never do so.
     *
     * Null if the account's signer does not expose key material.
     *
     * @type {KeyPair | null}
     */
    get keyPair(): KeyPair | null;
    /**
     * Signs a message.
     *
     * @param {string} message - The message to sign.
     * @returns {Promise<string>} The message's signature.
     * @throws {DisposalError} If the wallet account has been disposed.
     */
    sign(message: string): Promise<string>;
    /**
     * Signs a transaction.
     *
     * @param {SolanaTransaction} tx - The transaction to sign: an unsigned transaction or a base64-encoded serialized transaction.
     * @returns {Promise<FullySignedTransaction>} The signed transaction.
     * @throws {DisposalError} If the wallet account has been disposed.
     * @throws {ProviderRequiredError} If the wallet is not connected to a provider.
     * @throws {MaximumFeeExceededError} If the transaction's cost exceeds the maximum transaction fee option.
     */
    signTransaction(tx: SolanaTransaction): Promise<FullySignedTransaction>;
    /**
     * Quotes the costs of a send transaction operation.
     *
     * @param {SolanaTransaction | FullySignedTransaction} tx - The transaction. Either an unsigned transaction, an already-signed transaction, or a base64-encoded serialized transaction.
     * @returns {Promise<Omit<TransactionResult, 'hash'>>} The transaction's quotes.
     * @throws {ProviderRequiredError} If the wallet is not connected to a provider.
     */
    quoteSendTransaction(tx: SolanaTransaction | FullySignedTransaction): Promise<Omit<TransactionResult, "hash">>;
    /**
     * Sends a transaction.
     *
     * @param {SolanaTransaction | FullySignedTransaction} tx - The transaction. Either an unsigned transaction, an already-signed transaction, or a base64-encoded serialized transaction.
     * @returns {Promise<TransactionResult>} The transaction's result.
     * @throws {DisposalError} If the wallet account has been disposed.
     * @throws {ProviderRequiredError} If the wallet is not connected to a provider.
     * @throws {MaximumFeeExceededError} If the transaction's cost exceeds the maximum transaction fee option.
     */
    sendTransaction(tx: SolanaTransaction | FullySignedTransaction): Promise<TransactionResult>;
    /** @private */
    private _sendTransactionMessage;
    /** @private */
    private _signTransactionMessage;
    /**
     * Has the signer add its signature to a compiled transaction.
     *
     * @private
     * @param {Transaction} transaction - The compiled transaction.
     * @returns {Promise<FullySignedTransaction>} The signed transaction.
     * @throws {SolanaError} With code `SOLANA_ERROR__TRANSACTION__SIGNATURES_MISSING` if the transaction still misses signatures the account cannot provide.
     */
    private _signCompiledTransaction;
    /** @private */
    private _broadcastSignedTransaction;
    /**
     * Determines whether a value is an already-signed transaction (as returned by `signTransaction`)
     * rather than an unsigned {@link SolanaTransaction}.
     *
     * @protected
     * @param {SolanaTransaction | FullySignedTransaction} tx - The transaction to inspect.
     * @returns {boolean} True if the value is a signed transaction.
     */
    protected _isSignedTransaction(tx: SolanaTransaction | FullySignedTransaction): boolean;
    /**
     * Signs a base64-encoded serialized transaction (e.g. a swap or bridge payload built
     * by an external API) with the account's signer.
     *
     * @protected
     * @param {string} serializedTransaction - The base64-encoded serialized transaction.
     * @returns {Promise<FullySignedTransaction>} The signed transaction.
     * @throws {ValueError} If the transaction's fee payer is not the account.
     * @throws {SolanaError} With code `SOLANA_ERROR__TRANSACTION__SIGNATURES_MISSING` if the transaction still misses signatures the account cannot provide.
     */
    protected _signSerializedTransaction(serializedTransaction: string): Promise<FullySignedTransaction>;
    /**
     * Calculates the fee for an already-signed transaction.
     *
     * @protected
     * @param {FullySignedTransaction} signedTransaction - The signed transaction.
     * @returns {Promise<bigint>} The calculated transaction fee in lamports.
     */
    protected _getSignedTransactionFee(signedTransaction: FullySignedTransaction): Promise<bigint>;
    /** @private */
    private _prepareTransactionMessage;
    /**
     * Transfers a token to another address.
     *
     * @param {TransferOptions} options - The transfer's options.
     * @param {SolanaTransferOptions} [solanaOptions] - The transfer's Solana-specific options.
     * @returns {Promise<TransferResult>} The transfer's result.
     * @throws {DisposalError} If the wallet account has been disposed.
     * @throws {ProviderRequiredError} If the wallet is not connected to a provider.
     * @throws {MaximumFeeExceededError} If the transfer's cost exceeds the maximum transfer fee option.
     * @note only SPL tokens - won't work for native SOL
     */
    transfer(options: TransferOptions, solanaOptions?: SolanaTransferOptions): Promise<TransferResult>;
    /**
     * Returns a read-only copy of the account.
     *
     * @returns {Promise<WalletAccountReadOnlySolana>} The read-only account.
     */
    toReadOnlyAccount(): Promise<WalletAccountReadOnlySolana>;
    _solanaReadOnlyAccount: WalletAccountReadOnlySolana;
    /**
     * Disposes the wallet account. The signer given at construction, and its private key, is wiped only if the
     * account owns it (see {@link SignerOptions}); a caller-owned signer is left for the caller to dispose.
     */
    dispose(): void;
}
export type IWalletAccount<TSignedTransaction> = import("@tetherto/wdk-wallet").IWalletAccount<TSignedTransaction>;
export type KeyPair = import("@tetherto/wdk-wallet").KeyPair;
export type TransactionResult = import("@tetherto/wdk-wallet").TransactionResult;
export type TransferOptions = import("@tetherto/wdk-wallet").TransferOptions;
export type TransferResult = import("@tetherto/wdk-wallet").TransferResult;
export type SolanaTransferOptions = import("./wallet-account-read-only-solana.js").SolanaTransferOptions;
export type SolanaError = import("@solana/errors").SolanaError;
export type SolanaTransaction = import("./wallet-account-read-only-solana.js").SolanaTransaction;
export type SolanaWalletConfig = import("./wallet-account-read-only-solana.js").SolanaWalletConfig;
export type Transaction = import("@solana/transactions").Transaction;
export type FullySignedTransaction = import("@solana/transactions").FullySignedTransaction;
export type ISignerSolana = import("./signers/signer-solana.js").ISignerSolana;
export type SignerOptions = {
    /**
     * - If true, wipes the signer given at construction on calls to the 'dispose' method.
     */
    shouldWipeSignerOnDisposal?: boolean;
};
import WalletAccountReadOnlySolana from "./wallet-account-read-only-solana.js";
