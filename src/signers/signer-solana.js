'use strict'

import { NotImplementedError } from '@tetherto/wdk-wallet'

/**
 * Assert the full path is hardened.
 * @param {string} path The derivation path.
 */
export function assertFullHardenedPath (path) {
  const isValid = path.split('/').reduce((s, e) => s && e.endsWith("'"), true)

  if (!isValid) { throw new Error('In Solana, every child path in a derivation path must be hardened.') }
}

export class ISignerSolana {
  /**
   * The derivation path's index of this account. (i.e. m/purpose'/coin_type'/ **account'** /change/address_index)
   *
   *
   * @type {number}
   */
  get index () {
    throw new NotImplementedError('index')
  }

  /**
   * The derivation path of this account.
   *
   * @type {string}
   */
  get path () {
    throw new NotImplementedError('path')
  }

  /**
   * The signer config.
   *
   * @type {object}
   */
  get config () {
    throw new NotImplementedError('config')
  }

  /**
   * The account's key pair.
   *
   * Returns the raw key pair bytes in standard Solana format.
   * - privateKey: 32-byte Ed25519 secret key (Uint8Array)
   * - publicKey: 32-byte Ed25519 public key (Uint8Array)
   *
   * @type {KeyPair}
   */
  get keyPair () {
    throw new NotImplementedError('keyPair')
  }

  /**
   * Derive a child account.
   *
   * @param {string} relPath - The relative path.
   * @param {object} config - The config.
   * @returns {ISignerSolana} The child implementation of ISignerSolana.
   */
  derive (relPath, config = {}) {
    throw new NotImplementedError('derive(relPath, config = {})')
  }

  /**
   * Get address.
   *
   * @returns {Promise<string>} The address.
   */
  async getAddress () {
    throw new NotImplementedError('getAddress()')
  }

  /**
   * Signs a message.
   *
   * @param {string} message - The message to sign.
   * @returns {Promise<string>} The message's signature.
   */
  async sign (message) {
    throw new NotImplementedError('sign(message)')
  }

  /**
   * Verifies a message's signature.
   *
   * @param {string} message - The original message.
   * @param {string} signature - The signature to verify.
   * @returns {Promise<boolean>} True if the signature is valid.
   */
  async verify (message, signature) {
    throw new NotImplementedError('verify(message, signature)')
  }

  /**
   * Sign a transaction
   *
   * @param {Uint8Array} unsignedTx - The unsigned transaction.
   * @returns {Promise<Uint8Array>} The signed transaction.
   */
  async signTransaction (unsignedTx) {
    throw new NotImplementedError('signTransaction(unsignedTx)')
  }

  /**
   * Disposes the wallet account, erasing the private key from the memory.
   */
  dispose () {
    throw new NotImplementedError('dispose()')
  }
}
