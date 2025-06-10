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

"use strict";

import { createSolanaRpc } from "@solana/kit";
import * as bip39 from "bip39";
import WalletAccountSolana from "./wallet-account-solana.js";

const FEE_RATE_NORMAL_MULTIPLIER = 1.1,
  FEE_RATE_FAST_MULTIPLIER = 2.0;

/** @typedef {import('./wallet-account-solana.js').SolanaWalletConfig} SolanaWalletConfig */

export default class WalletManagerSolana {
  #seedPhrase;
  #rpc;
  #rpcUrl;
  #wsUrl;

  /**
   * Creates a new wallet manager for solana blockchains.
   *
   * @param {string} seedPhrase - The wallet's [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) seed phrase.
   * @param {SolanaWalletConfig} [config] - The configuration object.
   */
  constructor(seedPhrase, config = {}) {
    if (!WalletManagerSolana.isValidSeedPhrase(seedPhrase)) {
      throw new Error("The seed phrase is invalid.");
    }

    this.#seedPhrase = seedPhrase;

    const { rpcUrl, wsUrl } = config;

    if (rpcUrl) {
      this.#rpcUrl = rpcUrl;
      this.#rpc = createSolanaRpc(rpcUrl);
    }

    if (wsUrl) {
      this.#wsUrl = wsUrl;
    } else if (rpcUrl) {
      this.#wsUrl = rpcUrl.replace("http", "ws");
    }
  }

  /**
   * Returns a random [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) seed phrase.
   *
   * @returns {string} The seed phrase.
   */
  static getRandomSeedPhrase() {
    return bip39.generateMnemonic();
  }

  /**
   * Checks if a seed phrase is valid.
   *
   * @param {string} seedPhrase - The seed phrase.
   * @returns {boolean} True if the seed phrase is valid.
   */
  static isValidSeedPhrase(seedPhrase) {
    return bip39.validateMnemonic(seedPhrase);
  }

  /**
   * The seed phrase of the wallet.
   *
   * @type {string}
   */
  get seedPhrase() {
    return this.#seedPhrase;
  }

  /**
   * Returns the wallet account at a specific index (see [BIP-44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki)).
   *
   * @example
   * // Returns the account with derivation path m/44'/501'/0'/0'
   * const account = await wallet.getAccount(1);
   * @param {number} [index] - The index of the account to get (default: 0).
   * @returns {Promise<WalletAccountSolana>} The account.
   */
  async getAccount(index = 0) {
    return await this.getAccountByPath(`${index}'/0'`);
  }

  /**
   * Returns the wallet account at a specific BIP-44 derivation path.
   *
   * @example
   * // Returns the account with derivation path m/44'/501'/0'/0'
   * const account = await wallet.getAccountByPath("0'/0'");
   * @param {string} path - The derivation path (e.g. "0'/0'").
   * @returns {Promise<WalletAccountSolana>} The account.
   */
  async getAccountByPath(path) {
    return await WalletAccountSolana.create(this.#seedPhrase, path, {
      rpcUrl: this.#rpcUrl,
      wsUrl: this.#wsUrl,
    });
  }

  /**
   * Returns the current fee rates.
   *
   * @returns {Promise<{ normal: number, fast: number }>} The fee rates (in lamports).
   */
  async getFeeRates() {
    if (!this.#rpc) {
      throw new Error(
        "The wallet must be connected to a provider to get fee rates."
      );
    }

    try {
      // Get recent prioritization fees
      const fees = await this.#rpc.getRecentPrioritizationFees().send();

      // Find the highest non-zero fee, or use default
      const nonZeroFees = fees.filter(fee => fee.prioritizationFee > 0n);
      const baseFee = nonZeroFees.length > 0
        ? Number(nonZeroFees.reduce((max, fee) => fee.prioritizationFee > max ? fee.prioritizationFee : max, 0n))
        : 5000;

      const normalFee = Math.round(baseFee * FEE_RATE_NORMAL_MULTIPLIER);
      const fastFee = Math.round(baseFee * FEE_RATE_FAST_MULTIPLIER);

      return {
        normal: normalFee,
        fast: fastFee
      };
    } catch (error) {
      throw error;
    }
  }
}
