/**
 * Signer implementation that derives keys from a BIP-39 seed using a SLIP-0010 path.
 *
 * Every signer holds exactly one HD node and owns an independent copy of its key, so disposing
 * one never affects its parent, children or siblings. Intermediate nodes built while deriving
 * (including the master node) are erased as soon as they are no longer needed.
 *
 * @implements {ISignerSolana}
 */
export default class SeedSignerSolana implements ISignerSolana {
    /**
     * Creates a new seed signer.
     *
     * @param {string | Uint8Array} seed - A [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) mnemonic seed phrase, or a raw BIP-32 master seed (16-64 bytes).
     * @param {string} [path] - An absolute SLIP-0010 path; every segment must be hardened (default: "m/44'/501'").
     * @throws {ValueError} If the seed phrase is invalid, if the seed is not between 16 and 64 bytes, or if the path is not absolute, not a valid BIP-32 path or not fully hardened.
     */
    constructor(seed: string | Uint8Array, path?: string);
    /** @private */
    private _init;
    /** @private */
    private _node;
    /** @private */
    private _path;
    /** @private */
    private _rawPrivateKey;
    /** @private */
    private _rawPublicKey;
    /** @private */
    private _address;
    /** @private */
    private _disposed;
    /**
     * Whether the signer supports account derivation via {@link derive}.
     *
     * @type {true}
     */
    get isDerivable(): true;
    /**
     * The BIP 0032 derivation path, or null if the signer is not bound to a derivation position (e.g. private-key signers).
     * A seed signer's path is always absolute (e.g. "m/44'/501'/0'/0'").
     *
     * @type {string}
     */
    get path(): string;
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
     * Derive a child signer using a relative path (e.g., "0'/0'"). The path is relative to this signer's own
     * path: calling derive("0'/0'") on a signer at "m/44'/501'" yields a child at "m/44'/501'/0'/0'".
     *
     * @param {string} relPath - The path segment to derive, relative to this signer's own path.
     * @returns {Promise<SeedSignerSolana>} The derived child signer.
     * @throws {ValueError} If the path is absolute, not a valid BIP-32 path or not fully hardened.
     * @throws {DisposalError} If the signer has been disposed.
     */
    derive(relPath: string): Promise<SeedSignerSolana>;
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
     * Disposes the signer, securely erasing its private key and chain code from memory.
     */
    dispose(): void;
}
export type ISignerSolana = import("./signer-solana.js").ISignerSolana;
export type KeyPair = import("@tetherto/wdk-wallet").KeyPair;
export type HDKey = import("micro-key-producer/slip10.js").HDKey;
