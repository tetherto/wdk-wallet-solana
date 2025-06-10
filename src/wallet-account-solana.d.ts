export default class WalletAccountSolana {
  /**
   * Creates a new solana wallet account.
   *
   * @param {string | Uint8Array} seed - The wallet's [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) seed phrase.
   * @param {string} path - The BIP-44 derivation path (e.g. "0'/0/0").
   * @param {SolanaWalletConfig} [config] - The configuration object.
   */
  static create(seed: string | Uint8Array, path: string, config?: SolanaWalletConfig): Promise<WalletAccountSolana>;

  /**
   * Creates a new solana wallet account.
   *
   * @param {string | Uint8Array} seed - The wallet's [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) seed phrase.
   * @param {string} path - The BIP-44 derivation path (e.g. "0'/0/0").
   * @param {SolanaWalletConfig} [config] - The configuration object.
   */
  constructor(seed: string | Uint8Array, path: string, config?: SolanaWalletConfig);
  /**
   * The derivation path's index of this account.
   *
   * @type {number}
   */
  get index(): number;
  /**
   * The derivation path of this account.
   *
   * @type {string}
   */
  get path(): string;
  /**
   * The account's key pair.
   *
   * @type {KeyPair}
   */
  get keyPair(): KeyPair;
  /**
   * Returns the account's address.
   *
   * @returns {Promise<string>} The account's address.
   */
  getAddress(): Promise<string>;
  /**
   * Signs a message.
   *
   * @param {string} message - The message to sign.
   * @returns {Promise<string>} The message's signature.
   */
  sign(message: string): Promise<string>;
  /**
   * Verifies a message's signature.
   *
   * @param {string} message - The original message.
   * @param {string} signature - The signature to verify.
   * @returns {Promise<boolean>} True if the signature is valid.
   */
  verify(message: string, signature: string): Promise<boolean>;
  /**
   * Sends a transaction with arbitrary data.
   *
   * @param {SolanaTransaction} tx - The transaction to send.
   * @returns {Promise<string>} The transaction's hash.
   */
  sendTransaction(tx: SolanaTransaction): Promise<string>;
  /**
   * Quotes a transaction.
   *
   * @param {SolanaTransaction} tx - The transaction to quote.
   * @returns {Promise<number>} The transaction's fee (in lamports).
   */
  quoteTransaction(tx: SolanaTransaction): Promise<number>;
  /**
   * Returns the account's native token balance.
   *
   * @returns {Promise<number>} The native token balance in lamports.
   */
  getBalance(): Promise<number>;
  /**
   * Returns the account balance for a specific token.
   *
   * @param {string} tokenAddress - The token mint address.
   * @returns {Promise<number>} The token balance.
   */
  getTokenBalance(tokenAddress: string): Promise<{ raw: number; formatted: number }>;
  /**
   * Sends a token transaction.
   *
   * @param {Object} params - The transaction parameters.
   * @param {string} params.to - The recipient's address.
   * @param {string} params.tokenMint - The token mint address.
   * @param {number} params.amount - The amount of tokens to send.
   * @returns {Promise<string>} The transaction's hash.
   */
  sendTokenTransaction(params: { to: string; tokenMint: string; amount: number }): Promise<string>;
  #private;
}
export type KeyPair = {
  /**
   * - The public key.
   */
  publicKey: string;
  /**
   * - The private key.
   */
  privateKey: string;
};
export type SolanaTransaction = {
  /**
   * - The transaction's recipient.
   */
  to: string;
  /**
   * - The amount of SOL to send to the recipient (in lamports).
   */
  value: number;
  /**
   * - The transaction's data in hex format.
   */
  data?: string;
};
export type SolanaWalletConfig = {
  /**
   * - The rpc url of the provider.
   */
  rpcUrl?: string;
  /**
   * - The ws url of the provider is optional, if not provided, it will be derived from the rpc url.
   * Note: only use this if you want to use a custom ws url.
   */
  wsUrl?: string;
};
