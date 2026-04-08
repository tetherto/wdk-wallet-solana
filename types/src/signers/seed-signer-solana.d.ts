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
    _config: any;
    _isRoot: boolean;
    _root: HDKey;
    /**
     * The solana keypair
     * @private
     * @type {KeyPairSigner | undefined}
     */
    private _account;
    /**
     * The solana base58 address
     * @private
     * @type {string | undefined}
     */
    private _address;
    _path: string;
    _rawPublicKey: Uint8Array<ArrayBuffer>;
    _rawPrivateKey: Uint8Array<ArrayBuffer>;
    get isRoot(): boolean;
    get index(): number;
    get path(): string;
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
    derive(relPath: any, config?: {}): SeedSignerSolana;
    getAddress(): Promise<string>;
    sign(message: any): Promise<string>;
    verify(message: any, signature: any): Promise<boolean>;
    signTransaction(unsignedTx: any): Promise<Buffer>;
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
import HDKey from 'micro-key-producer/slip10.js';
