/** @implements {IWalletAccount} */
export default class WalletAccountSolana extends WalletAccountReadOnlySolana implements IWalletAccount {
    /**
     * Creates a new solana wallet account.
     *
     * @deprecated
     * @param {string | Uint8Array} seed - The wallet's [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) seed phrase.
     * @param {string} path - The SLIP-0010 derivation path (e.g. "0'/0'/0'").
     * @param {SolanaWalletConfig} [config] - The configuration object.
     * @returns {Promise<WalletAccountSolana>} The wallet account.
     */
    static at(seed: string | Uint8Array, path: string, config?: SolanaWalletConfig): Promise<WalletAccountSolana>;
    /**
     * Creates a new solana wallet account.
     *
     * @param {string | Uint8Array} seed - The wallet's [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) seed phrase.
     * @param {string} path - The SLIP-0010 derivation path (e.g. "0'/0'/0'").
     * @param {SolanaWalletConfig} [config] - The configuration object.
     */
    constructor(seed: string | Uint8Array, path: string, config?: SolanaWalletConfig);
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
     */
    sign(message: string): Promise<string>;
    /**
     * Signs a transaction.
     *
     * @param {SolanaTransaction} tx - The transaction to sign.
     * @returns {Promise<FullySignedTransaction>} The signed transaction.
     */
    signTransaction(tx: SolanaTransaction): Promise<FullySignedTransaction>;
    /**
     * Sends a transaction.
     *
     * @param {SolanaTransaction} tx - The transaction.
     * @returns {Promise<TransactionResult>} The transaction's result.
     */
    sendTransaction(tx: SolanaTransaction): Promise<TransactionResult>;
    /** @private */
    private _prepareTransactionMessage;
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
    /**
     * Creates a new {@link KeyPairSigner} from a 32-bytes `Uint8Array` private key.
     *
     * @private
     * @returns {Promise<KeyPairSigner>} - The keypair signer
     */
    _getSigner(): Promise<KeyPairSigner>;
}
export type IWalletAccount = import("@tetherto/wdk-wallet").IWalletAccount;
export type KeyPair = import("@tetherto/wdk-wallet").KeyPair;
export type TransactionResult = import("@tetherto/wdk-wallet").TransactionResult;
export type TransferOptions = import("@tetherto/wdk-wallet").TransferOptions;
export type TransferResult = import("@tetherto/wdk-wallet").TransferResult;
export type KeyPairSigner = import("@solana/signers").KeyPairSigner;
export type SolanaTransaction = import("./wallet-account-read-only-solana.js").SolanaTransaction;
export type SolanaWalletConfig = import("./wallet-account-read-only-solana.js").SolanaWalletConfig;
export type FullySignedTransaction = import("@solana/transactions").FullySignedTransaction;
import WalletAccountReadOnlySolana from "./wallet-account-read-only-solana.js";
