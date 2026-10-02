/**
 * Assert the full path is hardened.
 * @param {string} path The derivation path.
 * @throws {ValueError} If any child path is not hardened.
 */
export function assertFullHardenedPath(path: string): void;
/**
 * Assert the path is absolute ("m" or "m/...") and every segment below "m" is hardened.
 * @param {string} path The derivation path.
 * @throws {ValueError} If the path is not absolute or any child path is not hardened.
 */
export function assertAbsoluteHardenedPath(path: string): void;
/**
 * Interface for Solana signers, extending the base `ISigner` from `@tetherto/wdk-wallet`.
 *
 * @interface
 */
export class ISignerSolana extends ISigner {
    /**
     * Signs a transaction, keeping any signatures it already carries.
     *
     * @param {Uint8Array} unsignedTx - The wire-encoded transaction.
     * @returns {Promise<Uint8Array>} The wire-encoded transaction with this signer's signature added.
     */
    signTransaction(unsignedTx: Uint8Array): Promise<Uint8Array>;
}
import { ISigner } from "@tetherto/wdk-wallet";
