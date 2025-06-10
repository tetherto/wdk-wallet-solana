export { default } from "./src/wallet-manager-solana.js";
export { default as WalletAccountSolana } from "./src/wallet-account-solana.js";
export type SolanaWalletConfig =
  import("./src/wallet-manager-solana.js").SolanaWalletConfig;
export type KeyPair = import("./src/wallet-account-solana.js").KeyPair;
export type SolanaTransaction =
  import("./src/wallet-account-solana.js").SolanaTransaction;
