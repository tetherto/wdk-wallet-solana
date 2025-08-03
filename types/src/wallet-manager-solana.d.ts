export default class WalletManagerSolana extends WalletManager {
    /**
     * Creates a new wallet manager for the solana blockchain.
     *
     * @param {string | Uint8Array} seed - The wallet's [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) seed phrase.
     * @param {SolanaWalletConfig} [config] - The configuration object.
     */
    constructor(seed: string | Uint8Array, config?: SolanaWalletConfig);
    /**
     * A map between derivation paths and wallet accounts. It contains all the wallet accounts that have been accessed through the {@link getAccount} and {@link getAccountByPath} methods.
     *
     * @protected
     * @type {{ [path: string]: WalletAccountSolana }}
     */
    protected _accounts: {
        [path: string]: WalletAccountSolana;
    };
    /**
     * The solana rpc client.
     *
     * @protected
     * @type {SolanaRpc}
     */
    protected _rpc: SolanaRpc;
    /**
     * Returns the wallet account at a specific index (see [BIP-44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki)).
     *
     * @example
     * // Returns the account with derivation path m/44'/501'/0'/0/1
     * const account = await wallet.getAccount(1);
     * @param {number} [index] - The index of the account to get (default: 0).
     * @returns {Promise<WalletAccountSolana>} The account.
     */
    getAccount(index?: number): Promise<WalletAccountSolana>;
    /**
     * Returns the wallet account at a specific BIP-44 derivation path.
     *
     * @example
     * // Returns the account with derivation path m/44'/501'/0'/0/1
     * const account = await wallet.getAccountByPath("0'/0/1");
     * @param {string} path - The derivation path (e.g. "0'/0/0").
     * @returns {Promise<WalletAccountSolana>} The account.
     */
    getAccountByPath(path: string): Promise<WalletAccountSolana>;
    /**
     * Returns the current fee rates.
     *
     * @returns {Promise<FeeRates>} The fee rates (in lamports).
     */
    getFeeRates(): Promise<FeeRates>;
    /**
   * Disposes the wallet manager, erasing the seed buffer.
   */
    dispose(): void;
}
export type SolanaRpc = ReturnType<typeof createSolanaRpc>;
export type FeeRates = import("@wdk/wallet").FeeRates;
export type SolanaWalletConfig = import("./wallet-account-solana.js").SolanaWalletConfig;
import WalletManager from '@wdk/wallet';
import { createSolanaRpc } from '@solana/kit';
import WalletAccountSolana from './wallet-account-solana.js';
