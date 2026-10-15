/**
 * Asserts that every child path in the derivation path is hardened.
 *
 * @param {string} path - The derivation path.
 * @param {boolean} [absolute] - If true, the path must also be absolute ("m" or "m/...") (default: false).
 * @throws {ValueError} If the path is required to be absolute and is not, or if any child path is not hardened.
 */
export function assertFullHardenedPath(path: string, absolute?: boolean): void;
/**
 * Interface for Solana signers, extending the base `ISigner` from `@tetherto/wdk-wallet`.
 *
 * @interface
 */
export class ISignerSolana extends ISigner {
    /**
     * Derive a child signer using a relative path (e.g., "0'/0'").
     *
     * @param {string} path - The relative derivation path.
     * @returns {Promise<ISignerSolana>} The derived signer.
     * @throws {UnsupportedOperationError} If the signer does not support account derivation.
     * @throws {ValueError} If the path is not valid.
     * @throws {DisposalError} If the signer has been disposed.
     */
    derive(path: string): Promise<ISignerSolana>;
    /**
     * Signs a transaction, keeping any signatures it already carries.
     *
     * @param {Uint8Array} unsignedTx - The wire-encoded transaction.
     * @returns {Promise<Uint8Array>} The wire-encoded transaction with this signer's signature added.
     * @throws {DisposalError} If the signer has been disposed.
     */
    signTransaction(unsignedTx: Uint8Array): Promise<Uint8Array>;
}
import { ISigner } from "@tetherto/wdk-wallet";
export type DisposalError = import("@tetherto/wdk-wallet").DisposalError;
export type UnsupportedOperationError = import("@tetherto/wdk-wallet").UnsupportedOperationError;
