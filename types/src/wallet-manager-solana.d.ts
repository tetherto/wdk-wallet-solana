export default class WalletManagerSolana extends WalletManager {
    /**
     * Creates a new wallet manager for the solana blockchain.
     *
     * @param {string | Uint8Array} seed - The wallet's [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) seed phrase.
     * @param {SolanaWalletConfig} [config] - The configuration object.
     */
    constructor(seed: string | Uint8Array, config?: SolanaWalletConfig);
    /**
     * A Solana RPC client for HTTP requests.
     *
     * @protected
     * @type {import('@solana/kit').Rpc}
     */
    protected _rpc: any;
    /**
     * The commitment level for transactions.
     *
     * @protected
     * @type {string}
     */
    protected _commitment: string;
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
}
export type SolanaRpc = ReturnType<typeof createSolanaRpc>;
export type FeeRates = import("@tetherto/wdk-wallet").FeeRates;
export type SolanaWalletConfig = import("./wallet-account-solana.js").SolanaWalletConfig;
import WalletManager from '@tetherto/wdk-wallet';
import WalletAccountSolana from './wallet-account-solana.js';
import { createSolanaRpc } from '@solana/kit';
