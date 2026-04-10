/**
 * @implements {ISignerSolana}
 */
export default class SeedSignerSolana implements ISignerSolana {
    /**
     * @constructor
     * @param {string} seed The seed.
     * @param {SeedSignerSolCfg} config
     * @param {SeedSignerSolOpts} opts
     */
    constructor(seed: string, config?: SeedSignerSolCfg, opts?: SeedSignerSolOpts);
    /** @private */
    _config: SeedSignerSolCfg;
    /** @private */
    _isRoot: boolean;
    /** @private */
    _root: HDKey;
    /**
     * The solana keypair.
     * 
     * @private
     * @type {KeyPairSigner | undefined}
     */
    private _account;
    /** @private */
    private _address;
    /** @private */
    _path: string;
    /** @private */
    _rawPublicKey: Uint8Array<ArrayBuffer>;
    /** @private */
    _rawPrivateKey: Uint8Array<ArrayBuffer>;
    get config(): SeedSignerSolCfg;
    get isRoot(): boolean;
    get index(): number;
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
    get keyPair(): {
        privateKey: Uint8Array<ArrayBuffer>;
        publicKey: Uint8Array<ArrayBuffer>;
    };
    /**
     * Connect to the account.
     *
     * _The function name `connect` follows the hardware signer convention. Here, `connect` means deriving a child HD key from the root node._
     *
     * @private
     * @returns {Promise<void>} Void.
     */
    private _connect;
    derive(relPath: string, config?: {}): SeedSignerSolana;
    getAddress(): Promise<string>;
    sign(message: string): Promise<string>;
    verify(message: string, signature: string): Promise<boolean>;
    signTransaction(unsignedTx: Uint8Array): Promise<Uint8Array>;
    dispose(): void;
}
export type ISignerSolana = import("./signer-solana.js").ISignerSolana;
export type KeyPair = import("@tetherto/wdk-wallet").KeyPair;
export type HDKey = import("micro-key-producer/slip10.js").HDKey;
export type KeyPairSigner = import("@solana/signers").KeyPairSigner;
export type SeedSignerSolOpts = {
    /**
     * The root node that can be provided alternatively to the seed.
     */
    root?: HDKey;
    /**
     * The BIP-44 derivation path (e.g. "0'/0'"). Note that, All child paths must be hardened in Solana.
     */
    path?: string;
};
export type SeedSignerSolCfg = any;
