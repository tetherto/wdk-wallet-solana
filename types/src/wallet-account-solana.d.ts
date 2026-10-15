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
     * Creates a new solana wallet account.
     *
     * @param {string | Uint8Array} seed - A [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) mnemonic seed phrase, or a raw BIP-32 master seed (16-64 bytes).
     * @param {string} path - The SLIP-0010 derivation path (e.g. "0'/0'/0'").
     * @param {SolanaWalletConfig} [config] - The configuration object.
     * @throws {ValueError} If the seed phrase is not a valid BIP-39 seed phrase.
     */
    constructor(seed: string | Uint8Array, path: string, config?: SolanaWalletConfig);
    /**
     * The wallet account configuration.
     *
     * @protected
     * @type {SolanaWalletConfig}
     */
    protected _config: SolanaWalletConfig;
    /**
     * @private
     */
    private _seed;
    /**
     * @private
     */
    private _path;
    /**
     * The Ed25519 key pair signer for signing transactions.
     *
     * @private
     * @type {KeyPairSigner | undefined}
     */
    private _signer;
    /**
     * Raw Ed25519 private key bytes (32 bytes).
     *
     * @private
     * @type {Uint8Array | undefined}
     */
    private _rawPrivateKey;
    /**
     * Raw Ed25519 public key bytes (32 bytes).
     *
     * @private
     * @type {Uint8Array}
     */
    private _rawPublicKey;
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
     * The uint8 arrays are bound to the wallet account, so any external change will reflect to the internal representation. For this reason,
     * it's strongly recommended to treat the key pair as a read-only view of the keys. While it's still technically possible to alter their
     * content, client code should never do so.
     *
     * @type {KeyPair}
     */
    get keyPair(): KeyPair;
    /**
     * Signs a message.
     *
     * @param {string} message - The message to sign.
     * @returns {Promise<string>} The message's signature.
     * @throws {AssertionError} If the wallet account has been disposed.
     */
    sign(message: string): Promise<string>;
    /**
     * Signs a transaction.
     *
     * @param {SolanaTransaction} tx - The transaction to sign: an unsigned transaction or a base64-encoded serialized transaction.
     * @returns {Promise<FullySignedTransaction>} The signed transaction.
     * @throws {AssertionError} If the wallet account has been disposed.
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
     * @throws {AssertionError} If the wallet account has been disposed.
     * @throws {ProviderRequiredError} If the wallet is not connected to a provider.
     * @throws {MaximumFeeExceededError} If the transaction's cost exceeds the maximum transaction fee option.
     */
    sendTransaction(tx: SolanaTransaction | FullySignedTransaction): Promise<TransactionResult>;
    /**
     * Transfers a token to another address.
     *
     * @param {TransferOptions} options - The transfer's options.
     * @param {SolanaTransferOptions} [solanaOptions] - The transfer's Solana-specific options.
     * @returns {Promise<TransferResult>} The transfer's result.
     * @throws {AssertionError} If the wallet account has been disposed.
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
     * Disposes the wallet account, erasing the private key from the memory.
     */
    dispose(): void;
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
     * by an external API) with the account's key pair.
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
    /**
     * Returns the signer the instructions requiring this account's signature are built with:
     * the account's own key pair signer.
     *
     * @protected
     * @returns {Promise<KeyPairSigner>} The signer.
     */
    protected _getTransactionSigner(): Promise<KeyPairSigner>;
    /** @private */
    private _sendTransactionMessage;
    /** @private */
    private _broadcastSignedTransaction;
    /**
     * Prepares an unsigned transaction for signing: builds a native transfer object into a
     * transaction message, sets its lifetime when missing, and installs the account's key pair
     * signer as fee payer. Any signer that an instruction carries for this account's address is
     * a placeholder, and is replaced by the account's own key pair signer.
     *
     * @private
     * @param {SolanaTransaction} tx - The transaction: a native transfer object or a transaction message.
     * @returns {Promise<TransactionMessage>} The transaction message, ready to be signed.
     */
    private _prepareTransactionMessage;
    /**
     * Creates a new {@link KeyPairSigner} from a 32-bytes `Uint8Array` private key.
     *
     * @private
     * @returns {Promise<KeyPairSigner>} - The keypair signer
     */
    private _getSigner;
}
export type IWalletAccount<TSignedTransaction> = import("@tetherto/wdk-wallet").IWalletAccount<TSignedTransaction>;
export type KeyPair = import("@tetherto/wdk-wallet").KeyPair;
export type TransactionResult = import("@tetherto/wdk-wallet").TransactionResult;
export type TransferOptions = import("@tetherto/wdk-wallet").TransferOptions;
export type TransferResult = import("@tetherto/wdk-wallet").TransferResult;
export type SolanaTransferOptions = import("./wallet-account-read-only-solana.js").SolanaTransferOptions;
export type SolanaError = import("@solana/errors").SolanaError;
export type KeyPairSigner = import("@solana/signers").KeyPairSigner;
export type SolanaTransaction = import("./wallet-account-read-only-solana.js").SolanaTransaction;
export type TransactionMessage = import("@solana/transaction-messages").TransactionMessage;
export type SolanaWalletConfig = import("./wallet-account-read-only-solana.js").SolanaWalletConfig;
export type FullySignedTransaction = import("@solana/transactions").FullySignedTransaction;
import WalletAccountReadOnlySolana from './wallet-account-read-only-solana.js';
