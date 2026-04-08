/**
 * Assert the full path is hardened.
 * @param {string} path The derivation path.
 */
export function assertFullHardenedPath(path: string): void;
export class ISignerSolana {
    /**
     * The derivation path's index of this account. (i.e. m/purpose'/coin_type'/ **account'** /change/address_index)
     *
     *
     * @type {number}
     */
    get index(): number;
    /**
     * The derivation path of this account.
     *
     * @type {string}
     */
    get path(): string;
    /**
     * The signer config.
     *
     * @type {object}
     */
    get config(): object;
    /**
     * The account's key pair.
     *
     * Returns the raw key pair bytes in standard Solana format.
     * - privateKey: 32-byte Ed25519 secret key (Uint8Array)
     * - publicKey: 32-byte Ed25519 public key (Uint8Array)
     *
     * @type {KeyPair}
     */
    get keyPair(): KeyPair;
    /**
     * Derive a child account.
     *
     * @param {string} relPath - The relative path.
     * @param {object} config - The config.
     * @returns {ISignerSolana} The child implementation of ISignerSolana.
     */
    derive(relPath: string, config?: object): ISignerSolana;
    /**
     * Get address.
     *
     * @returns {Promise<string>} The address.
     */
    getAddress(): Promise<string>;
    /**
     * Signs a message.
     *
     * @param {string} message - The message to sign.
     * @returns {Promise<string>} The message's signature.
     */
    sign(message: string): Promise<string>;
    /**
     * Verifies a message's signature.
     *
     * @param {string} message - The original message.
     * @param {string} signature - The signature to verify.
     * @returns {Promise<boolean>} True if the signature is valid.
     */
    verify(message: string, signature: string): Promise<boolean>;
    /**
     * Sign a transaction
     *
     * @param {Uint8Array} unsignedTx - The unsigned transaction.
     * @returns {Promise<Uint8Array>} The signed transaction.
     */
    signTransaction(unsignedTx: Uint8Array): Promise<Uint8Array>;
    /**
     * Disposes the wallet account, erasing the private key from the memory.
     */
    dispose(): void;
}
