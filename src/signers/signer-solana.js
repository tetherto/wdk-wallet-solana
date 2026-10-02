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

/**
 * Assert the full path is hardened.
 * @param {string} path The derivation path.
 * @throws {ValueError} If any child path is not hardened.
 */
export function assertFullHardenedPath (path) {
  const isValid = path.split('/').reduce((s, e) => s && e.endsWith("'"), true)

  if (!isValid) {
    throw new ValueError('In Solana, every child path in a derivation path must be hardened.')
  }
}

/**
 * Assert the path is absolute ("m" or "m/...") and every segment below "m" is hardened.
 * @param {string} path The derivation path.
 * @throws {ValueError} If the path is not absolute or any child path is not hardened.
 */
export function assertAbsoluteHardenedPath (path) {
  if (path === 'm') {
    return
  }

  if (!path.startsWith('m/')) {
    throw new ValueError('The derivation path must be absolute (e.g. "m/44\'/501\'").')
  }

  assertFullHardenedPath(path.slice(2))
}

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
  async signTransaction (unsignedTx) {
    throw new NotImplementedError('signTransaction(unsignedTx)')
  }
}
