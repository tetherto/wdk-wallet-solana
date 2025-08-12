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

import WalletManager from '@wdk/wallet'

import { createSolanaRpc } from '@solana/kit'

import WalletAccountSolana from './wallet-account-solana.js'

/** @typedef {ReturnType<import('@solana/rpc').createSolanaRpc>} SolanaRpc */

/** @typedef {import('@wdk/wallet').FeeRates} FeeRates */

/** @typedef {import('./wallet-account-solana.js').SolanaWalletConfig} SolanaWalletConfig */

const FEE_RATE_NORMAL_MULTIPLIER = 1.1

const FEE_RATE_FAST_MULTIPLIER = 2.0

const DEFAULT_BASE_FEE = 5_000

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

    /**
     * A map between derivation paths and wallet accounts. It contains all the wallet accounts that have been accessed through the {@link getAccount} and {@link getAccountByPath} methods.
     *
     * @protected
     * @type {{ [path: string]: WalletAccountSolana }}
     */
    this._accounts = {}

    /**
     * The solana rpc client.
     *
     * @protected
     * @type {SolanaRpc}
     */
    this._rpc = createSolanaRpc(this._config.rpcUrl)
  }

  /**
   * Returns the wallet account at a specific index (see [BIP-44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki)).
   *
   * @example
   * // Returns the account with derivation path m/44'/501'/0'/0/1
   * const account = await wallet.getAccount(1);
   * @param {number} [index] - The index of the account to get (default: 0).
   * @returns {Promise<WalletAccountSolana>} The account.
   */
  async getAccount (index = 0) {
    return await this.getAccountByPath(`0'/0/${index}`)
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

    const nonZeroFees = fees.filter(fee => fee.prioritizationFee > 0n)

    const fee = nonZeroFees.length > 0
      ? Number(nonZeroFees.reduce((max, fee) => fee.prioritizationFee > max ? fee.prioritizationFee : max, 0n))
      : DEFAULT_BASE_FEE

    return {
      normal: Math.round(fee * FEE_RATE_NORMAL_MULTIPLIER),
      fast: fee * FEE_RATE_FAST_MULTIPLIER
    }
  }

  /**
   * Disposes all the wallet accounts, erasing their private keys from the memory.
   */
  dispose () {
    for (const account of Object.values(this._accounts)) {
      account.dispose()
    }

    this._accounts = {}
  }
}
