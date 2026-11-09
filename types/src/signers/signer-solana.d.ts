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
     * @param {string | Uint8Array} unsignedTx - The wire-encoded transaction, as bytes or a base58 string.
     * @returns {Promise<Uint8Array>} The wire-encoded transaction with this signer's signature added.
     * @throws {ValueError} If the transaction is a string that is not base58, or if it doesn't include this signer among its signatures.
     * @throws {DisposalError} If the signer has been disposed.
     */
    signTransaction(unsignedTx: string | Uint8Array): Promise<Uint8Array>;
}
import { ISigner } from "@tetherto/wdk-wallet";
export type DisposalError = import("@tetherto/wdk-wallet").DisposalError;
export type UnsupportedOperationError = import("@tetherto/wdk-wallet").UnsupportedOperationError;
