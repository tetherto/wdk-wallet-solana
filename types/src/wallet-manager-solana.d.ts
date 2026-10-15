export default class WalletManagerSolana extends WalletManager<ISignerSolana> {
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
    constructor(signer: ISignerSolana, config?: SolanaWalletConfig);
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
    constructor(seed: string | Uint8Array, config?: SolanaWalletConfig);
    /**
     * If true, disposes the default signer on calls to the 'dispose' method.
     *
     * @protected
     * @type {boolean}
     */
    protected _shouldWipeDefaultSignerOnDisposal: boolean;
    /**
     * The solana wallet configuration.
     *
     * @protected
     * @type {SolanaWalletConfig}
     */
    protected _config: SolanaWalletConfig;
    /**
     * A Solana RPC client for HTTP requests. Shared with every account this manager creates,
     * so two accounts never open two clients for the same endpoint.
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
    getAccount(index?: number, options?: AccountOptions): Promise<WalletAccountSolana>;
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
    getAccount(signerName: string): Promise<WalletAccountSolana>;
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
    getAccountByPath(path: string, options?: AccountOptions): Promise<WalletAccountSolana>;
    /**
     * Builds the account config, injecting the manager's shared rpc client so accounts reuse
     * it instead of opening their own.
     *
     * @private
     * @returns {SolanaWalletConfig} The account configuration.
     */
    private _accountConfig;
    /**
     * Returns the current fee rates.
     *
     * @returns {Promise<FeeRates>} The fee rates (in lamports).
     * @throws {ProviderRequiredError} If the wallet is not connected to a provider.
     */
    getFeeRates(): Promise<FeeRates>;
    /**
     * Disposes all wallet accounts, and the default signer if the manager built it from a seed.
     * A signer supplied by the caller, as the default or via {@link addSigner}, is never disposed.
     */
    dispose(): void;
}
export type SolanaRpc = ReturnType<typeof import("@solana/rpc").createSolanaRpc>;
export type Commitment = import("@solana/rpc-types").Commitment;
export type FeeRates = import("@tetherto/wdk-wallet").FeeRates;
export type SolanaWalletConfig = import("./wallet-account-solana.js").SolanaWalletConfig;
export type ISignerSolana = import("./signers/signer-solana.js").ISignerSolana;
export type PrivateKeySignerSolana = import("./signers/private-key-signer-solana.js").default;
export type AccountOptions = {
    /**
     * - The name of a signer registered via `addSigner`. Omit to use the default signer.
     */
    signerName?: string;
};
import WalletManager from "@tetherto/wdk-wallet";
import WalletAccountSolana from "./wallet-account-solana.js";
