/**
 * Signer backed by a single raw Ed25519 private key (non-HD).
 *
 * Does not support HD derivation. Signs messages and transactions directly with the key.
 *
 * @implements {ISignerSolana}
 */
export default class PrivateKeySignerSolana implements ISignerSolana {
    /**
     * Creates a new private key signer.
     *
     * Accepts a 32-byte Ed25519 private key (as a hex string or bytes), or a 64-byte Solana secret key,
     * the private key followed by its public key, as exported by `solana-keygen` and wallets (as a base58
     * string or bytes).
     *
     * The supplied key is copied: the signer keeps its own internal copy alive until {@link dispose}
     * zeroes it, and never wipes the supplied key, whose disposal remains the caller's responsibility.
     *
     * @param {string | Uint8Array} privateKey - The private key or secret key.
     * @throws {ValueError} If the key is in neither format, or if a secret key's public half does not match its private half.
     */
    constructor(privateKey: string | Uint8Array);
    /**
     * Raw Ed25519 private key bytes (32 bytes), owned by the signer.
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
    /** @private */
    private _address;
    /** @private */
    private _disposed;
    /**
     * Whether this signer can derive child signers.
     *
     * @type {false}
     */
    get isDerivable(): false;
    /**
     * The derivation path. Always null for private-key signers.
     *
     * @type {null}
     */
    get path(): null;
    /**
     * True if the signer has been disposed.
     *
     * @type {boolean}
     */
    get disposed(): boolean;
    /**
     * The account's key pair.
     *
     * @type {KeyPair}
     */
    get keyPair(): KeyPair;
    /**
     * Derives a child signer using a relative path.
     *
     * @param {string} path - The relative derivation path.
     * @returns {Promise<never>} The derived signer.
     * @throws {UnsupportedOperationError} If the signer does not support account derivation.
     */
    derive(path: string): Promise<never>;
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
     * @throws {DisposalError} If the signer has been disposed.
     */
    sign(message: string): Promise<string>;
    /**
     * Signs a transaction, keeping any signatures it already carries.
     *
     * @param {Uint8Array} unsignedTx - The wire-encoded transaction.
     * @returns {Promise<Uint8Array>} The wire-encoded transaction with this signer's signature added.
     * @throws {DisposalError} If the signer has been disposed.
     */
    signTransaction(unsignedTx: Uint8Array): Promise<Uint8Array>;
    /**
     * Disposes the signer, securely erasing its internal copy of the private key from memory.
     */
    dispose(): void;
}
export type ISignerSolana = import("./signer-solana.js").ISignerSolana;
export type KeyPair = import("@tetherto/wdk-wallet").KeyPair;
