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

import WalletManager, { DisposalError, ProviderRequiredError } from '@tetherto/wdk-wallet'

import WalletAccountSolana from './wallet-account-solana.js'

/** @typedef {ReturnType<typeof import('@solana/rpc').createSolanaRpc>} SolanaRpc */
/** @typedef {import('@solana/rpc-types').Commitment} Commitment */

/** @typedef {import('@tetherto/wdk-wallet').FeeRates} FeeRates */

/** @typedef {import('./wallet-account-solana.js').SolanaWalletConfig} SolanaWalletConfig */

const FEE_RATE_NORMAL_MULTIPLIER = 110n

const FEE_RATE_FAST_MULTIPLIER = 200n

const DEFAULT_BASE_FEE = 5_000n

export default class WalletManagerSolana extends WalletManager {
  /**
   * Creates a new wallet manager for the solana blockchain.
   *
   * @param {string | Uint8Array} seed - A [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) mnemonic seed phrase, or a raw BIP-32 master seed (16-64 bytes).
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

    const { commitment = 'confirmed' } = config

    /**
     * The commitment level for transactions.
     *
     * @protected
     * @type {Commitment}
     */
    this._commitment = commitment

    /**
     * A Solana RPC client for HTTP requests. Shared with every account this manager creates,
     * so two accounts never open two clients for the same endpoint.
     *
     * @protected
     * @type {SolanaRpc | undefined}
     */
    this._rpc = WalletAccountSolana._buildRpc(config)
  }

  /**
   * Returns the wallet account at a specific index (see [SLIP-0010](https://slips.readthedocs.io/en/latest/slip-0010/)).
   *
   * @example
   * // Returns the account with derivation path m/44'/501'/index'/0'
   * const account = await wallet.getAccount(1);
   * @param {number} [index] - The index of the account to get (default: 0).
   * @returns {Promise<WalletAccountSolana>} The account.
   * @throws {DisposalError} If the wallet manager has been disposed.
   */
  async getAccount (index = 0) {
    return await this.getAccountByPath(`${index}'/0'`)
  }

  /**
   * Returns the wallet account at a specific SLIP-0010 derivation path.
   *
   * @example
   * // Returns the account with derivation path m/44'/501'/0'/0'/1'
   * const account = await wallet.getAccountByPath("0'/0'/1'");
   * @param {string} path - The derivation path (e.g. "0'/0'/0'").
   * @returns {Promise<WalletAccountSolana>} The account.
   * @throws {DisposalError} If the wallet manager has been disposed.
   */
  async getAccountByPath (path) {
    if (this.disposed) {
      throw new DisposalError('The wallet manager has been disposed.')
    }

    if (!this._accounts[path]) {
      const account = new WalletAccountSolana(this.seed, path, this._accountConfig())

      this._accounts[path] = account
    }

    return this._accounts[path]
  }

  /**
   * Builds the account config, injecting the manager's shared rpc client so accounts reuse
   * it instead of opening their own.
   *
   * @private
   * @returns {SolanaWalletConfig} The account configuration.
   */
  _accountConfig () {
    return { ...this._config, provider: this._rpc }
  }

  /**
   * Returns the current fee rates.
   *
   * @returns {Promise<FeeRates>} The fee rates (in lamports).
   * @throws {ProviderRequiredError} If the wallet is not connected to a provider.
   */
  async getFeeRates () {
    if (!this._rpc) {
      throw new ProviderRequiredError('The wallet must be connected to a provider to get fee rates.')
    }

    const fees = await this._rpc.getRecentPrioritizationFees().send()

    const nonZeroFees = fees.filter((fee) => fee.prioritizationFee > 0).map((fee) => BigInt(fee.prioritizationFee))

    const fee =
      nonZeroFees.length > 0 ? nonZeroFees.reduce((max, fee) => (fee > max ? fee : max), 0n) : DEFAULT_BASE_FEE

    return {
      normal: (fee * FEE_RATE_NORMAL_MULTIPLIER) / 100n,
      fast: (fee * FEE_RATE_FAST_MULTIPLIER) / 100n
    }
  }
}
