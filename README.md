# @tetherto/wdk-wallet-solana

[![npm version](https://img.shields.io/npm/v/%40tetherto%2Fwdk-wallet-solana?style=flat-square)](https://www.npmjs.com/package/@tetherto/wdk-wallet-solana)
[![npm downloads](https://img.shields.io/npm/dw/%40tetherto%2Fwdk-wallet-solana?style=flat-square)](https://www.npmjs.com/package/@tetherto/wdk-wallet-solana)
[![license](https://img.shields.io/npm/l/%40tetherto%2Fwdk-wallet-solana?style=flat-square)](https://github.com/tetherto/wdk-wallet-solana/blob/main/LICENSE)
[![docs](https://img.shields.io/badge/docs-docs.wdk.tether.io-0A66C2?style=flat-square)](https://docs.wdk.tether.io/sdk/wallet-modules/wallet-solana)

**Note**: This package is currently in beta. Please test thoroughly in development environments before using in production.

A Solana wallet module for WDK (Wallet Development Kit) by Tether. This package provides a clean API for creating, managing, and interacting with Solana wallets using BIP-39 seed phrases and Solana-specific derivation paths.

## About WDK

This module is part of the [**WDK (Wallet Development Kit)**](https://docs.wdk.tether.io/) project, which empowers developers to build secure, non-custodial wallets with unified blockchain access, stateless architecture, and complete user control.

For detailed documentation about the complete WDK ecosystem, visit [docs.wdk.tether.io](https://docs.wdk.tether.io).

## Installation

```bash
npm install @tetherto/wdk-wallet-solana
```

## Quick Start

```javascript
import WalletManagerSolana from '@tetherto/wdk-wallet-solana'

const seedPhrase = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

const wallet = new WalletManagerSolana(seedPhrase, {
  provider: 'https://api.devnet.solana.com',
  commitment: 'confirmed',
})

const account = await wallet.getAccount(0)
const address = await account.getAddress()
console.log('Address:', address)

wallet.dispose()
```

## Key Capabilities

- **SLIP-0010 Derivation Paths**: Standard Solana derivation support (`m/44'/501'`)
- **Multi-Account Management**: Derive multiple accounts from a single seed phrase
- **Native SOL Transactions**: Quote and send SOL transfers through a unified wallet API
- **SPL Token Support**: Query balances and transfer SPL tokens, under both the classic Token Program and the Token Extensions Program (Token-2022)
- **Transfer Memos**: Attach a UTF-8 memo to a token transfer
- **Message Signing**: Sign messages and verify signatures with Solana accounts
- **Fee Estimation**: Retrieve current network fee rates and quote transaction costs
- **Read-Only Accounts**: Monitor any Solana address without a private key
- **Secure Memory Disposal**: Clear private keys from memory when done

## Token-2022 Support

Balances and transfers work the same way for classic SPL tokens and Token-2022 tokens: the
wallet reads the mint to find which program owns it. A Token-2022 mint without extensions
behaves exactly like a classic one. For mints with extensions, `transfer` and `quoteTransfer`
apply the following rules.

| Extension | Behaviour |
| --- | --- |
| Transfer fee | Supported. `amount` is gross: the sender is debited `amount` and the recipient receives `amount` less the fee. `quoteTransfer` reports the fee as `transferFee`. |
| Interest-bearing | Supported. Balances are the raw amounts held, without accrued interest. |
| Required memo (on the recipient's account) | Supported. Pass `{ memo }` as the second argument to `transfer`; without a memo, the token program rejects the transfer on chain. |
| Default account state: initialized | Supported. |
| Pausable | Supported. Transfers fail on chain while the mint is paused. |
| Non-transferable | Rejected with `NonTransferableTokenError`: the token cannot move at all. |
| Transfer hook | Supported when no hook program is set, since no hook runs. Rejected with `TransferHookNotSupportedError` when one is set: the wallet does not resolve the accounts a hook program needs. |
| Confidential transfer | Rejected with `ConfidentialTransferNotSupportedError`: the wallet does not perform confidential transfers. |
| Default account state: frozen | Supported between existing, thawed accounts. A transfer that would have to create the recipient's account is rejected with `FrozenTokenAccountError`, since the new account would be frozen and unable to receive. |

A transfer to a recipient whose token account is frozen is also rejected with
`FrozenTokenAccountError`. Other extensions need no special handling and are transferred
unchanged. All four errors are exported from the package.

`quoteTransfer` returns, next to the network `fee`:

- `rent`: the lamports deposited to create the recipient's token account when it does not
  exist yet, or `0n`. A Token-2022 account is larger than a classic one, and larger again
  for a fee-bearing mint, so it costs more.
- `transferFee`: the token amount withheld by a fee-bearing mint, or `0n`.

```javascript
const quote = await account.quoteTransfer({ token, recipient, amount: 1000000n }, { memo: 'invoice 42' })
// { fee: 5000n, rent: 2157600n, transferFee: 5000n }

await account.transfer({ token, recipient, amount: 1000000n }, { memo: 'invoice 42' })
```

## Compatibility

- **Solana Mainnet Beta**
- **Solana Testnet**
- **Solana Devnet**
- **Standard Solana RPC Providers** that support account, balance, and fee queries

## Documentation

| Topic | Description | Link |
|-------|-------------|------|
| Overview | Module overview and feature summary | [Wallet Solana Overview](https://docs.wdk.tether.io/sdk/wallet-modules/wallet-solana) |
| Usage | End-to-end integration walkthrough | [Wallet Solana Usage](https://docs.wdk.tether.io/sdk/wallet-modules/wallet-solana/usage) |
| Configuration | RPC, commitment, and transfer configuration | [Wallet Solana Configuration](https://docs.wdk.tether.io/sdk/wallet-modules/wallet-solana/configuration) |
| API Reference | Complete class and type reference | [Wallet Solana API Reference](https://docs.wdk.tether.io/sdk/wallet-modules/wallet-solana/api-reference) |

## Examples

| Example | Description |
|---------|-------------|
| [Create Wallet](https://github.com/tetherto/wdk-examples/blob/main/wallet-solana/create-wallet.ts) | Initialize a wallet manager and derive Solana accounts from a seed phrase |
| [Manage Accounts](https://github.com/tetherto/wdk-examples/blob/main/wallet-solana/manage-accounts.ts) | Work with multiple accounts and custom SLIP-0010 derivation paths |
| [Check Balances](https://github.com/tetherto/wdk-examples/blob/main/wallet-solana/check-balances.ts) | Query native SOL and SPL token balances for owned accounts |
| [Read-Only Account](https://github.com/tetherto/wdk-examples/blob/main/wallet-solana/read-only-account.ts) | Monitor balances for any Solana address without a private key |
| [Send Transaction](https://github.com/tetherto/wdk-examples/blob/main/wallet-solana/send-transaction.ts) | Estimate fees and send native SOL transactions |
| [Token Transfer](https://github.com/tetherto/wdk-examples/blob/main/wallet-solana/token-transfer.ts) | Transfer SPL tokens and estimate transfer fees |
| [Sign & Verify Message](https://github.com/tetherto/wdk-examples/blob/main/wallet-solana/sign-verify-message.ts) | Sign messages and verify signatures |
| [Fee Management](https://github.com/tetherto/wdk-examples/blob/main/wallet-solana/fee-management.ts) | Retrieve current network fee rates |
| [Memory Management](https://github.com/tetherto/wdk-examples/blob/main/wallet-solana/memory-management.ts) | Securely dispose wallets and clear private keys from memory |

> For detailed walkthroughs, see the [Usage Guide](https://docs.wdk.tether.io/sdk/wallet-modules/wallet-solana/usage).
> See all runnable examples in the [wdk-examples](https://github.com/tetherto/wdk-examples) repository.

## Community

Join the [WDK Discord](https://discord.gg/arYXDhHB2w) to connect with other developers.

## Support

For support, please [open an issue](https://github.com/tetherto/wdk-wallet-solana/issues) on GitHub or reach out via [email](mailto:wallet-info@tether.io).

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.
