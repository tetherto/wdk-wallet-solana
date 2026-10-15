// Copyright 2024 Tether Operations Limited
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use strict'

import { ISigner, NotImplementedError, ValueError } from '@tetherto/wdk-wallet'

/** @typedef {import('@tetherto/wdk-wallet').DisposalError} DisposalError */
/** @typedef {import('@tetherto/wdk-wallet').UnsupportedOperationError} UnsupportedOperationError */

/**
 * Asserts that every child path in the derivation path is hardened.
 *
 * @param {string} path - The derivation path.
 * @param {boolean} [absolute] - If true, the path must also be absolute ("m" or "m/...") (default: false).
 * @throws {ValueError} If the path is required to be absolute and is not, or if any child path is not hardened.
 */
export function assertFullHardenedPath (path, absolute = false) {
  if (absolute) {
    if (path === 'm') {
      return
    }

    if (!path.startsWith('m/')) {
      throw new ValueError('The derivation path must be absolute (e.g. "m/44\'/501\'").')
    }

    path = path.slice(2)
  }

  const isValid = path.split('/').every((segment) => /^\d+'$/.test(segment))

  if (!isValid) {
    throw new ValueError('In Solana, every child path in a derivation path must be hardened.')
  }
}

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
  async derive (path) {
    throw new NotImplementedError('derive(path)')
  }

  /**
   * Signs a transaction, keeping any signatures it already carries.
   *
   * @param {Uint8Array} unsignedTx - The wire-encoded transaction.
   * @returns {Promise<Uint8Array>} The wire-encoded transaction with this signer's signature added.
   * @throws {DisposalError} If the signer has been disposed.
   */
  async signTransaction (unsignedTx) {
    throw new NotImplementedError('signTransaction(unsignedTx)')
  }
}
