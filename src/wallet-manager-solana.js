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

import WalletManager, { InvalidSignerError, ProviderRequiredError } from '@tetherto/wdk-wallet'

import WalletAccountSolana from './wallet-account-solana.js'
import SeedSignerSolana from './signers/seed-signer-solana.js'

/** @typedef {ReturnType<typeof import('@solana/rpc').createSolanaRpc>} SolanaRpc */
/** @typedef {import('@solana/rpc-types').Commitment} Commitment */

/** @typedef {import('@tetherto/wdk-wallet').FeeRates} FeeRates */

/** @typedef {import('./wallet-account-solana.js').SolanaWalletConfig} SolanaWalletConfig */

/** @typedef {import('./signers/signer-solana.js').ISignerSolana} ISignerSolana */
/** @typedef {import('./signers/private-key-signer-solana.js').default} PrivateKeySignerSolana */

/**
 * @typedef {Object} AccountOptions
 * @property {string} [signerName] - The name of a signer registered via `addSigner`. Omit to use the default signer.
 */

const FEE_RATE_NORMAL_MULTIPLIER = 110n

const FEE_RATE_FAST_MULTIPLIER = 200n

const DEFAULT_BASE_FEE = 5_000n

/** @extends {WalletManager<ISignerSolana>} */
export default class WalletManagerSolana extends WalletManager {
  /**
   * Creates a new wallet manager for the solana blockchain from a default signer.
   *
   * The default signer must be derivable (it must be able to derive child accounts);
   * non-derivable signers (e.g. private-key signers) are not allowed as the default but
   * may be registered by name via {@link addSigner}.
   * **Warning:** the signer is kept exactly as given, not cloned. Disposing it directly breaks
   * further account derivation, and the manager never disposes a signer you supplied.
   *
   * @overload
   * @param {ISignerSolana} signer - The default root signer.
   * @param {SolanaWalletConfig} [config] - The configuration object.
   */

  /**
   * Creates a new wallet manager for the solana blockchain from a seed.
   *
   * The manager wraps the seed in a {@link SeedSignerSolana} at "m/44'/501'", owns it, and wipes it on
   * {@link dispose}. The seed itself is not kept.
   *
   * @overload
   * @param {string | Uint8Array} seed - A [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) mnemonic seed phrase, or a raw BIP-32 master seed (16-64 bytes).
   * @param {SolanaWalletConfig} [config] - The configuration object.
   */
  constructor (seedOrSigner, config = {}) {
    const isSeed = typeof seedOrSigner === 'string' || seedOrSigner instanceof Uint8Array

    super(isSeed ? new SeedSignerSolana(seedOrSigner) : seedOrSigner, config)

    /**
     * If true, disposes the default signer on calls to the 'dispose' method.
     *
     * @protected
     * @type {boolean}
     */
    this._shouldWipeDefaultSignerOnDisposal = isSeed

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
   * **Warning:** derivation is relative to the signer's own path. If the signer sits at a leaf
   * (e.g. m/44'/501'/0'/0'), getAccount(1) derives m/44'/501'/0'/0'/1'/0', probably not what
   * you want; use a signer at the coin-type node (m/44'/501'), which is where
   * `SeedSignerSolana` sits by default.
   *
   * @example
   * // Returns the account with derivation path m/44'/501'/index'/0'
   * const account = await wallet.getAccount(1);
   * @overload
   * @param {number} [index] - The index of the account to get (default: 0).
   * @param {AccountOptions} [options] - Account options.
   * @returns {Promise<WalletAccountSolana>} The account.
   */

  /**
   * Returns the wallet account backed by a registered signer, without further derivation.
   * Use it for non-derivable signers, such as {@link PrivateKeySignerSolana}.
   *
   * @example
   * wallet.addSigner('treasury', new PrivateKeySignerSolana(privateKey))
   * const account = await wallet.getAccount('treasury');
   * @overload
   * @param {string} signerName - The signer name registered via {@link addSigner}.
   * @returns {Promise<WalletAccountSolana>} The account.
   */

  /**
   * @param {number | string} [indexOrSignerName] - The account index, or a registered signer name (default: 0).
   * @param {AccountOptions} [options] - Account options.
   * @returns {Promise<WalletAccountSolana>} The account.
   */
  async getAccount (indexOrSignerName = 0, options = {}) {
    if (typeof indexOrSignerName === 'string') {
      const signerName = indexOrSignerName

      if (!this._accounts[signerName]) {
        this._accounts[signerName] = new WalletAccountSolana(this.getSigner(signerName), this._accountConfig())
      }

      return this._accounts[signerName]
    }

    return await this.getAccountByPath(`${indexOrSignerName}'/0'`, options)
  }

  /**
   * Returns the wallet account at a specific SLIP-0010 derivation path.
   *
   * @example
   * // Returns the account with derivation path m/44'/501'/0'/0'/1'
   * const account = await wallet.getAccountByPath("0'/0'/1'");
   * @param {string} path - The derivation path (e.g. "0'/0'/0'").
   * @param {AccountOptions} [options] - Account options.
   * @returns {Promise<WalletAccountSolana>} The account.
   * @throws {InvalidSignerError} If the signer doesn't support account derivation.
   */
  async getAccountByPath (path, options = {}) {
    const { signerName } = options
    const key = signerName === undefined ? path : `${signerName}:${path}`

    if (!this._accounts[key]) {
      const rootSigner = this.getSigner(signerName)

      if (!rootSigner.isDerivable) {
        throw new InvalidSignerError('The signer does not support account derivation.')
      }

      const signer = await rootSigner.derive(path)

      this._accounts[key] = new WalletAccountSolana(signer, { ...this._accountConfig(), shouldWipeSignerOnDisposal: true })
    }

    return this._accounts[key]
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
   * Disposes all wallet accounts, and the default signer if the manager built it from a seed.
   * A signer supplied by the caller, as the default or via {@link addSigner}, is never disposed.
   */
  dispose () {
    if (this._shouldWipeDefaultSignerOnDisposal) {
      this._defaultSigner.dispose()
    }

    super.dispose()
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
