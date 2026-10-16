/**
 * Creates a version 1 off-chain message.
 *
 * An off-chain message is the byte string that gets signed, so that a message
 * signature can never be a valid transaction signature.
 *
 * @param {string} message - The message content. It must be a non-empty string.
 * @param {Uint8Array} signerPublicKey - The Ed25519 public key of the required signer (32 bytes).
 * @returns {Uint8Array} The off-chain message bytes.
 * @throws {ValueError} If the message is not a non-empty string.
 */
export function createOffchainMessage(message: string, signerPublicKey: Uint8Array): Uint8Array;
/**
 * The signing domain prefix shared by every version 1 off-chain message.
 *
 * @see {@link https://docs.anza.xyz/proposals/off-chain-message-signing}
 *
 * @type {Uint8Array}
 */
export const OFFCHAIN_MESSAGE_SIGNING_DOMAIN: Uint8Array;
/**
 * The version of the off-chain message format.
 *
 * @type {number}
 */
export const OFFCHAIN_MESSAGE_VERSION: number;
