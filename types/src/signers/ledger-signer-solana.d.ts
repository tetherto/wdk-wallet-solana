export function constructOffchainMessageV0Content(addr: string, message: string): Uint8Array;
/**
 * @implements {ISignerSolana}
 */
export default class LedgerSignerSolana implements ISignerSolana {
    /**
     * @constructor
     * @param {string} path The BIP-44 derivation path (e.g. "0'/0'"). Note that, All child paths must be hardened in Solana.
     * @param {LedgerSignerSolCfg} config - The signer configuration. Currently unused.
     * @param {LedgerSignerSolOpts} opts - Optional constructor dependencies.
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
    /**
     * Ensures the device is in a usable state before sending actions.
     * - If the device is locked or busy, fails fast with a friendly error.
     * - If the device is not connected, attempts to reconnect.
     *
     * @private
     * @throws {Error} If the device is locked, busy, or not ready before the timeout expires.
     */
    private _ensureDeviceReady(): Promise<void>;
    /**
     * Consume a DeviceAction observable and resolve on Completed; reject early on Error/Stopped.
     *
     * @private
     * @template TOutput
     * @param {Observable<DeviceActionState<TOutput>>} observable
     * @returns {Promise<TOutput>}
     */
    private _consumeDeviceAction<TOutput>(observable: Observable<DeviceActionState<TOutput>>): Promise<TOutput>;
    /** @private */
    private _disconnect(): Promise<void>;
}
export type ISignerSolana = import("./signer-solana.js").ISignerSolana;
export type DeviceManagementKit = import("@ledgerhq/device-management-kit").DeviceManagementKit;
export type DefaultSignerSolana = import("@ledgerhq/device-signer-kit-solana/internal/DefaultSignerSolana.js").DefaultSignerSolana;
export type OffchainMessage = import("@solana/offchain-messages").OffchainMessage;
export type LedgerSignerSolOpts = {
    /**
     * Shared [DMK](https://developers.ledger.com/docs/device-interaction/integration/how_to/dmk).
     */
    dmk?: DeviceManagementKit;
};
export type LedgerSignerSolCfg = {};
export type Observable<T> = import("rxjs").Observable<T>;
export type DeviceActionState<TOutput> = import("@ledgerhq/device-management-kit").DeviceActionState<TOutput, unknown, unknown>;
