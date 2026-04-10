export function constructOffchainMessageV0Content(addr: string, message: string): Uint8Array;
/**
 * @implements {ISignerSolana}
 */
export default class LedgerSignerSolana implements ISignerSolana {
    /**
     * @constructor
     * @param {string} path The BIP-44 derivation path (e.g. "0'/0'"). Note that, All child paths must be hardened in Solana.
     * @param {LedgerSignerSolCfg} config
     * @param {LedgerSignerSolOpts} opts
     */
    constructor(path: string, config?: LedgerSignerSolCfg, opts?: LedgerSignerSolOpts);
    _config: LedgerSignerSolCfg;
    /**
     * The ledger signer.
     * 
     * @private
     * @type {DefaultSignerSolana | undefined}
     */
    _account: DefaultSignerSolana | undefined;
    /** @private */
    _address: string | undefined;
    /** @private */
    _sessionId: string;
    /** @private */
    _path: string;
    /**
     * @private
     * @type {DeviceManagementKit}
     */
    _dmk: DeviceManagementKit;
    get index(): number;
    get path(): string;
    get config(): LedgerSignerSolCfg;
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
    derive(relPath: string, cfg?: LedgerSignerSolCfg): LedgerSignerSolana;
    getAddress(): Promise<string>;
    sign(message: string): Promise<string>;
    verify(message: string, signature: string): Promise<boolean>;
    signTransaction(unsignedTx: Uint8Array): Promise<Uint8Array>;
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
