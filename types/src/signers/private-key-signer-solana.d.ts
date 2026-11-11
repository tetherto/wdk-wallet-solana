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
     * Whether the signer supports account derivation via {@link derive}.
     *
     * @type {false}
     */
    get isDerivable(): false;
    /**
     * The BIP 0032 derivation path, or null if the signer is not bound to a derivation position (e.g. private-key signers).
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
     * The signer's key pair, or null if the signer does not allow retrieving key material (e.g. hardware signers).
     * A Solana signer always exposes its key pair; the private key is null once the signer is disposed.
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
     * Returns the signer's address.
     *
     * @returns {Promise<string>} The signer's address.
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
     * @param {string | Uint8Array} unsignedTx - The wire-encoded transaction, as bytes or a base58 string.
     * @returns {Promise<Uint8Array>} The wire-encoded transaction with this signer's signature added.
     * @throws {DisposalError} If the signer has been disposed.
     */
    signTransaction(unsignedTx: string | Uint8Array): Promise<Uint8Array>;
    /**
     * Disposes the signer, securely erasing its internal copy of the private key from memory.
     */
    dispose(): void;
    /** @private */
    private _guardDisposed;
}
export type ISignerSolana = import("./signer-solana.js").ISignerSolana;
export type KeyPair = import("@tetherto/wdk-wallet").KeyPair;
