export function constructOffchainMessageV0Content(addr: string, message: string): Uint8Array;
/**
 * @implements {ISignerSolana}
 */
export default class LedgerSignerSol implements ISignerSolana {
    /**
     * @constructor
     * @param {string} path The BIP-44 derivation path (e.g. "0'/0'"). Note that, All child paths must be hardened in Solana.
     * @param {LedgerSignerSolCfg} config
     * @param {LedgerSignerSolOpts} opts
     */
    constructor(path: string, config?: LedgerSignerSolCfg, opts?: LedgerSignerSolOpts);
    _config: any;
    /**
     * @type {DefaultSignerSolana | undefined} The solana signer.
     */
    _account: DefaultSignerSolana | undefined;
    _address: any;
    _sessionId: string;
    _path: string;
    /**
     * @type {DeviceManagementKit}
     */
    _dmk: DeviceManagementKit;
    get index(): number;
    get path(): string;
    get config(): any;
    get address(): any;
    /**
     * Discover and connect the device
     *
     * @private
     */
    private _connect;
    /**
     * Derive child signer
     * @param {string} relPath The BIP-44 derivation path (e.g. "0'/0'"). Note that, All child paths must be hardened in Solana.
     * @param {LedgerSignerSolCfg} cfg
     * @returns
     */
    derive(relPath: string, cfg?: LedgerSignerSolCfg): LedgerSignerSol;
    getAddress(): Promise<any>;
    sign(message: any): Promise<string>;
    verify(message: any, signature: any): Promise<boolean>;
    signTransaction(unsignedTx: any): Promise<Uint8Array<ArrayBuffer>>;
    dispose(): void;
    /** @private */
    private _disconnect;
}
export type ISignerSolana = import("./signer-solana.js").ISignerSolana;
export type DeviceManagementKit = any;
export type DefaultSignerSolana = any;
export type OffchainMessage = any;
export type LedgerSignerSolOpts = {
    /**
     * Shared [DMK](https://developers.ledger.com/docs/device-interaction/integration/how_to/dmk).
     */
    dmk?: DeviceManagementKit;
};
export type LedgerSignerSolCfg = any;
