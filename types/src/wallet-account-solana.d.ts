/** @implements {IWalletAccount} */
export default class WalletAccountSolana extends WalletAccountReadOnlySolana implements IWalletAccount {
    /**
     * Creates a new solana wallet account.
     *
     * @param {string | Uint8Array} seed - The wallet's [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) seed phrase.
     * @param {string} path - The BIP-44 derivation path (e.g. "0'/0/0").
     * @param {SolanaWalletConfig} [config] - The configuration object.
     * @returns {Promise<WalletAccountSolana>} The wallet account.
     */
    static at(seed: string | Uint8Array, path: string, config?: SolanaWalletConfig): Promise<WalletAccountSolana>;
    /** @private */
    private constructor(seed, path, config);
    /**
     * The wallet account configuration.
     *
     * @protected
     * @type {SolanaWalletConfig}
     */
    protected _config: SolanaWalletConfig;
    /** @private */
    private _path;
    /** @private */
    private _keyPair;
    /** @private */
    private _signer;
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
     * Sends a transaction.
     *
     * @param {SolanaTransaction} tx - The transaction.
     * @returns {Promise<TransactionResult>} The transaction's result.
     */
    sendTransaction(tx: SolanaTransaction): Promise<TransactionResult>;
    /**
     * Transfers a token to another address.
     *
     * @param {TransferOptions} options - The transfer's options.
     * @returns {Promise<TransferResult>} The transfer's result.
     */
    transfer(options: TransferOptions): Promise<TransferResult>;
    /**
     * Returns a read-only copy of the account.
     *
     * @returns {Promise<WalletAccountReadOnlySolana>} The read-only account.
     */
    toReadOnlyAccount(): Promise<WalletAccountReadOnlySolana>;
    /**
     * Disposes the wallet account, erasing the private key from the memory.
     */
    dispose(): void;
}
export type IWalletAccount = import("@wdk/wallet").IWalletAccount;
export type KeyPair = import("@wdk/wallet").KeyPair;
export type TransactionResult = import("@wdk/wallet").TransactionResult;
export type TransferOptions = import("@wdk/wallet").TransferOptions;
export type TransferResult = import("@wdk/wallet").TransferResult;
export type SolanaTransaction = import("./wallet-account-read-only-solana.js").SolanaTransaction;
export type SolanaWalletConfig = import("./wallet-account-read-only-solana.js").SolanaWalletConfig;
import WalletAccountReadOnlySolana from './wallet-account-read-only-solana.js';
