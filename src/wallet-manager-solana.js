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

import WalletManager from '@tetherto/wdk-wallet'

import { createSolanaRpc } from '@solana/rpc'

import WalletAccountSolana from './wallet-account-solana.js'

/** @typedef {ReturnType<typeof import('@solana/rpc').createSolanaRpc>} SolanaRpc */

/** @typedef {import('@tetherto/wdk-wallet').FeeRates} FeeRates */

/** @typedef {import('./wallet-account-solana.js').SolanaWalletConfig} SolanaWalletConfig */

const FEE_RATE_NORMAL_MULTIPLIER = 110n

const FEE_RATE_FAST_MULTIPLIER = 200n

const DEFAULT_BASE_FEE = 5_000n

export default class WalletManagerSolana extends WalletManager {
  /**
   * Creates a new wallet manager for the solana blockchain.
   *
   * @param {string | Uint8Array} seed - The wallet's [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) seed phrase.
   * @param {SolanaWalletConfig} [config] - The configuration object.
   */
  constructor (seed, config = {}) {
    super(seed, config)

    /**
    * The solana wallet configuration.
    *
    * @protected
    * @type {SolanaWalletConfig}
    */
    this._config = config

    const { rpcUrl, commitment = 'confirmed' } = config

    if (rpcUrl) {
      /**
       * A Solana RPC client for HTTP requests.
       *
       * @protected
       * @type {SolanaRpc}
       */
      this._rpc = createSolanaRpc(rpcUrl)

      /**
       * The commitment level for transactions.
       *
       * @protected
       * @type {string}
       */
      this._commitment = commitment
    }
  }

  /**
   * Returns the wallet account at a specific index (see [BIP-44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki)).
   *
   * @example
   * // Returns the account with derivation path m/44'/501'/index'/0'
   * const account = await wallet.getAccount(1);
   * @param {number} [index] - The index of the account to get (default: 0).
   * @returns {Promise<WalletAccountSolana>} The account.
   */
  async getAccount (index = 0) {
    return await this.getAccountByPath(`${index}'/0'`)
  }

  /**
   * Returns the wallet account at a specific BIP-44 derivation path.
   *
   * @example
   * // Returns the account with derivation path m/44'/501'/0'/0/1
   * const account = await wallet.getAccountByPath("0'/0/1");
   * @param {string} path - The derivation path (e.g. "0'/0/0").
   * @returns {Promise<WalletAccountSolana>} The account.
   */
  async getAccountByPath (path) {
    if (!this._accounts[path]) {
      const account = await WalletAccountSolana.at(this.seed, path, this._config)

      this._accounts[path] = account
    }

    return this._accounts[path]
  }

  /**
 * Returns the current fee rates.
 *
 * @returns {Promise<FeeRates>} The fee rates (in lamports).
 */
  async getFeeRates () {
    if (!this._rpc) {
      throw new Error('The wallet must be connected to a provider to get fee rates.')
    }

    const fees = await this._rpc.getRecentPrioritizationFees().send()

    const nonZeroFees = fees
      .filter(fee => fee.prioritizationFee > 0)
      .map(fee => BigInt(fee.prioritizationFee))

    const fee = nonZeroFees.length > 0
      ? nonZeroFees.reduce((max, fee) => fee > max ? fee : max, 0n)
      : DEFAULT_BASE_FEE

    return {
      normal: fee * FEE_RATE_NORMAL_MULTIPLIER / 100n,
      fast: fee * FEE_RATE_FAST_MULTIPLIER / 100n
    }
  }
}
