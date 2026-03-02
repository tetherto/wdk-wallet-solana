/**
 * Full-featured Solana wallet account implementation with signing capabilities.
 *
 */
export default class WalletAccountSolana extends WalletAccountReadOnlySolana {
    /**
     * Creates a new solana wallet account.
     *
     * @param {string | Uint8Array} seed - The wallet's [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) seed phrase.
     * @param {string} path - The SLIP-0010 derivation path (e.g. "0'/0'/0'").
     * @param {SolanaWalletConfig} [config] - The configuration object.
     * @returns {Promise<WalletAccountSolana>} The wallet account.
     */
    static at(seed: string | Uint8Array, path: string, config?: SolanaWalletConfig): Promise<WalletAccountSolana>;
    /**
     * @private
     * Use {@link WalletAccountSolana.at} instead.
     */
    private constructor();
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
     * Raw Ed25519 public key bytes (32 bytes).
     *
     * @private
     * @type {Uint8Array | undefined}
     */
    private _rawPublicKey;
    /**
     * Raw Ed25519 private key bytes (32 bytes).
     *
     * @private
     * @type {Uint8Array | undefined}
     */
    private _rawPrivateKey;
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
     * Returns the raw key pair bytes in standard Solana format.
     * - privateKey: 32-byte Ed25519 secret key (Uint8Array)
     * - publicKey: 32-byte Ed25519 public key (Uint8Array)
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
     * @note only SPL tokens - won't work for native SOL
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
export type IWalletAccount = import("@tetherto/wdk-wallet").IWalletAccount;
export type KeyPair = import("@tetherto/wdk-wallet").KeyPair;
export type TransactionResult = import("@tetherto/wdk-wallet").TransactionResult;
export type TransferOptions = import("@tetherto/wdk-wallet").TransferOptions;
export type TransferResult = import("@tetherto/wdk-wallet").TransferResult;
export type KeyPairSigner = import("@solana/signers").KeyPairSigner;
export type SolanaTransaction = import("./wallet-account-read-only-solana.js").SolanaTransaction;
export type SolanaWalletConfig = import("./wallet-account-read-only-solana.js").SolanaWalletConfig;
import WalletAccountReadOnlySolana from "./wallet-account-read-only-solana.js";
