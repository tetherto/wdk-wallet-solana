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
     * @type {SolanaRpc | undefined}
     */
    protected _rpc: SolanaRpc | undefined;
    /**
     * The commitment level for transactions.
     *
     * @protected
     * @type {Commitment}
     */
    protected _commitment: Commitment;
    /**
     * Returns the wallet account at a specific index (see [SLIP-0010](https://slips.readthedocs.io/en/latest/slip-0010/)).
     *
     * @example
     * // Returns the account with derivation path m/44'/501'/index'/0'
     * const account = await wallet.getAccount(1);
     * @param {number} [index] - The index of the account to get (default: 0).
     * @returns {Promise<WalletAccountSolana>} The account.
     */
    getAccount(index?: number): Promise<WalletAccountSolana>;
    /**
     * Returns the wallet account at a specific SLIP-0010 derivation path.
     *
     * @example
     * // Returns the account with derivation path m/44'/501'/0'/0'/1'
     * const account = await wallet.getAccountByPath("0'/0'/1'");
     * @param {string} path - The derivation path (e.g. "0'/0'/0'").
     * @returns {Promise<WalletAccountSolana>} The account.
     */
    getAccountByPath(path: string): Promise<WalletAccountSolana>;
    /**
     * Returns the current fee rates.
     *
     * @returns {Promise<FeeRates>} The fee rates (in lamports).
     */
    getFeeRates(): Promise<FeeRates>;
}
export type SolanaRpc = ReturnType<typeof import("@solana/rpc").createSolanaRpc>;
export type Commitment = import("@solana/rpc-types").Commitment;
export type FeeRates = import("@tetherto/wdk-wallet").FeeRates;
export type SolanaWalletConfig = import("./wallet-account-solana.js").SolanaWalletConfig;
import WalletManager from "@tetherto/wdk-wallet";
import WalletAccountSolana from "./wallet-account-solana.js";
