/** @typedef {import("@tetherto/wdk-wallet").IWalletAccount} IWalletAccount */
/** @typedef {import('@tetherto/wdk-wallet').KeyPair} KeyPair */
/** @typedef {import('@tetherto/wdk-wallet').TransactionResult} TransactionResult */
/** @typedef {import('@tetherto/wdk-wallet').TransferOptions} TransferOptions */
/** @typedef {import('@tetherto/wdk-wallet').TransferResult} TransferResult */
/** @typedef {import('./wallet-account-read-only-solana.js').SolanaTransaction} SolanaTransaction */
/** @typedef {import('./wallet-account-read-only-solana.js').SolanaWalletConfig} SolanaWalletConfig */
/** @typedef {import('@tetherto/wdk-wallet-solana/signers').ISignerSolana} ISignerSolana */
/**
 * Full-featured Solana wallet account implementation with signing capabilities.
 *
 */
export default class WalletAccountSolana extends WalletAccountReadOnlySolana {
    /**
     * Creates a new solana wallet account.
     *
     * @param {ISignerSolana} signer - The solana signer.
     * @param {SolanaWalletConfig} config - The wallet account configuration.
     */
    constructor(signer: ISignerSolana, config?: SolanaWalletConfig);
    /**
     * The Solana seed signer.
     *
     * @private
     * @type {ISignerSolana}
     */
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
export type ISignerSolana = import("@tetherto/wdk-wallet-solana/signers").ISignerSolana;
import WalletAccountReadOnlySolana from './wallet-account-read-only-solana.js';
