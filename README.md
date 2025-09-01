# @wdk/wallet-solana

A simple and secure package to manage BIP-44 wallets for the Solana blockchain. This package provides a clean API for creating, managing, and interacting with Solana wallets using BIP-39 seed phrases and Solana-specific derivation paths.

## 🔍 About WDK

This module is part of the [**WDK (Wallet Development Kit)**](https://wallet.tether.io/) project, which empowers developers to build secure, non-custodial wallets with unified blockchain access, stateless architecture, and complete user control. 

For detailed documentation about the complete WDK ecosystem, visit [docs.wallet.tether.io](https://docs.wallet.tether.io).

## 🌟 Features

- **BIP-39 Seed Phrase Support**: Generate and validate BIP-39 mnemonic seed phrases
- **Solana Derivation Paths**: Support for BIP-44 standard derivation paths for Solana (m/44'/501')
- **Multi-Account Management**: Create and manage multiple accounts from a single seed phrase
- **Solana Address Support**: Generate and manage Solana public keys and addresses
- **Message Signing**: Sign and verify messages using Ed25519 cryptography
- **Transaction Management**: Send transactions and get fee estimates
- **SPL Token Support**: Query native SOL and SPL token balances
- **TypeScript Support**: Full TypeScript definitions included
- **Memory Safety**: Secure private key management with memory-safe implementation
- **Provider Flexibility**: Support for custom Solana RPC endpoints
- **Fee Estimation**: Dynamic fee calculation with recent blockhash
- **Program Interaction**: Support for interacting with Solana programs

## ⬇️ Installation

To install the `@wdk/wallet-solana` package, follow these instructions:

### Public Release

Once the package is publicly available, you can install it using npm:

```bash
npm install @wdk/wallet-solana
```

### Private Access

If you have access to the private repository, install the package from the develop branch on GitHub:

```bash
npm install git+https://github.com/tetherto/wdk-wallet-solana.git#develop
```

After installation, ensure your package.json includes the dependency correctly:

```json
"dependencies": {
  // ... other dependencies ...
  "@wdk/wallet-solana": "git+ssh://git@github.com:tetherto/wdk-wallet-solana.git#develop"
  // ... other dependencies ...
}
```

## 🚀 Quick Start

### Importing from `@wdk/wallet-solana`

1. WalletManagerSolana: Main class for managing wallets
2. WalletAccountSolana: Use this for full access accounts
3. WalletAccountReadOnlySolana: Use this for read-only accounts

### Creating a New Wallet

```javascript
import WalletManagerSolana, { 
  WalletAccountSolana, 
  WalletAccountReadOnlySolana 
} from '@wdk/wallet-solana'

// Use a BIP-39 seed phrase (replace with your own secure phrase)
const seedPhrase = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

// Create wallet manager with Solana RPC provider
const wallet = new WalletManagerSolana(seedPhrase, {
  provider: 'https://api.mainnet-beta.solana.com', // or any Solana RPC endpoint
  commitment: 'confirmed' // Optional: commitment level
})

// Get a full access account
const account = await wallet.getAccount(0)

// Convert to a read-only account
const readOnlyAccount = await account.toReadOnlyAccount()
```

### Managing Multiple Accounts

```javascript
import WalletManagerSolana from '@wdk/wallet-solana'

// Assume wallet is already created
// Get the first account (index 0)
const account = await wallet.getAccount(0)
const address = await account.getAddress()
console.log('Account 0 address:', address)

// Get the second account (index 1)
const account1 = await wallet.getAccount(1)
const address1 = await account1.getAddress()
console.log('Account 1 address:', address1)

// Get account by custom derivation path
const customAccount = await wallet.getAccountByPath("0'/0/5")
const customAddress = await customAccount.getAddress()
console.log('Custom account address:', customAddress)

// Note: All addresses are base58-encoded Solana public keys
// All accounts inherit the provider configuration from the wallet manager
```

### Checking Balances

#### Owned Account

For accounts where you have the seed phrase and full access:

```javascript
import WalletManagerSolana from '@wdk/wallet-solana'

// Assume wallet and account are already created
// Get native SOL balance (in lamports)
const balance = await account.getBalance()
console.log('Native balance:', balance, 'lamports') // 1 SOL = 1000000000 lamports

// Get SPL token balance
const tokenMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC mint address
const tokenBalance = await account.getTokenBalance(tokenMint);
console.log('Token balance:', tokenBalance);

// Note: Provider is required for balance checks
// Make sure wallet was created with a provider configuration
```

#### Read-Only Account

For addresses where you don't have the seed phrase:

```javascript
import { WalletAccountReadOnlySolana } from '@wdk/wallet-solana'

// Create a read-only account
const readOnlyAccount = new WalletAccountReadOnlySolana('publicKey', { // Base58-encoded public key
  provider: 'https://api.mainnet-beta.solana.com',
  commitment: 'confirmed'
})

// Check native SOL balance
const balance = await readOnlyAccount.getBalance()
console.log('Native balance:', balance, 'lamports')

// Check SPL token balance
const tokenBalance = await readOnlyAccount.getTokenBalance('EPjFWdd5...') // Token mint address
console.log('Token balance:', tokenBalance)

// Note: Token balances are returned in the token's smallest units
// Make sure to adjust for the token's decimals when displaying
```
### Sending Transactions

Send SOL and estimate fees using `WalletAccountSolana`. All transactions require a recent blockhash.

```javascript
// Send native SOL
const result = await account.sendTransaction({
  recipient: 'publicKey', // Recipient's base58-encoded public key
  value: 1000000000n, // 1 SOL in lamports
  commitment: 'confirmed' // Optional: commitment level
})
console.log('Transaction signature:', result.signature)
console.log('Transaction fee:', result.fee, 'lamports')


// Get transaction fee estimate
const quote = await account.quoteSendTransaction({
  recipient: 'publicKey',
  value: 1000000000n
});
console.log('Estimated fee:', quote.fee, 'lamports');

// Note: Fees are calculated based on recent blockhash and instruction count
```

### Token Transfers

Transfer SPL tokens and estimate fees using `WalletAccountSolana`. Uses Token Program instructions.

```javascript
// Transfer SPL tokens
const transferResult = await account.transfer({
  token: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // Token mint address
  recipient: 'publicKey',  // Recipient's base58-encoded public key
  amount: 1000000n     // Amount in token's base units (use BigInt for large numbers)
}, {
  commitment: 'confirmed' // Optional: commitment level
});
console.log('Transaction signature:', transferResult.signature);
console.log('Transfer fee:', transferResult.fee, 'lamports');

// Quote token transfer fee
const transferQuote = await account.quoteTransfer({
  token: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // Token mint address
  recipient: 'publicKey',  // Recipient's base58-encoded public key
  amount: 1000000n     // Amount in token's base units
})
console.log('Transfer fee estimate:', transferQuote.fee, 'lamports')

// Note: If recipient doesn't have a token account, one will be created automatically
```

### Message Signing and Verification

Sign and verify messages using Ed25519 cryptography.

```javascript
// Sign a message
const message = 'Hello, Solana!'
const signature = await account.sign(message)
console.log('Signature:', signature)

// Verify a signature
const isValid = await account.verify(message, signature)
console.log('Signature valid:', isValid)
```

### Fee Management

Retrieve current fee rates using `WalletManagerSolana`. Rates are calculated based on recent blockhash and compute unit prices.

```javascript
// Get current fee rates
const feeRates = await wallet.getFeeRates();
console.log('Normal fee rate:', feeRates.normal, 'lamports'); // Standard compute unit price
console.log('Fast fee rate:', feeRates.fast, 'lamports');     // Priority compute unit price with higher unit limit
```

### Memory Management

Clear sensitive data from memory using `dispose` methods in `WalletAccountSolana` and `WalletManagerSolana`.

```javascript
// Dispose wallet accounts to clear private keys from memory
account.dispose()

// Dispose entire wallet manager
wallet.dispose()
```

## 📚 API Reference

### Table of Contents

| Class | Description | Methods |
|-------|-------------|---------|
| [WalletManagerSolana](#walletmanagersolana) | Main class for managing Solana wallets. Extends `WalletManager` from `@wdk/wallet`. | [Constructor](#constructor), [Methods](#methods) |
| [WalletAccountSolana](#walletaccountsolana) | Individual Solana wallet account implementation. Extends `WalletAccountReadOnlySolana` and implements `IWalletAccount`. | [Constructor](#constructor-1), [Methods](#methods-1), [Properties](#properties) |
| [WalletAccountReadOnlySolana](#walletaccountreadonlysolana) | Read-only Solana wallet account. | [Constructor](#constructor-2), [Methods](#methods-2) |

### WalletManagerSolana

The main class for managing Solana wallets.  
Extends `WalletManager` from `@wdk/wallet`.

#### Constructor

```javascript
new WalletManagerSolana(seed, config)
```

**Parameters:**
- `seed` (string | Uint8Array): BIP-39 mnemonic seed phrase or seed bytes
- `config` (object): Configuration object
  - `provider` (string | Connection): RPC endpoint URL or Solana Connection instance
  - `commitment` (string, optional): Commitment level ('processed', 'confirmed', or 'finalized')
  - `transferMaxFee` (number, optional): Maximum fee amount for transfer operations (in lamports)

**Example:**
```javascript
const wallet = new WalletManagerSolana(seedPhrase, {
  provider: 'https://api.mainnet-beta.solana.com',
  commitment: 'confirmed',
  transferMaxFee: 5000 // Maximum fee in lamports
})
```

#### Methods

| Method | Description | Returns |
|--------|-------------|---------|
| `getAccount(index)` | Returns a wallet account at the specified index | `Promise<WalletAccountSolana>` |
| `getAccountByPath(path)` | Returns a wallet account at the specified BIP-44 derivation path | `Promise<WalletAccountSolana>` |
| `getFeeRates()` | Returns current fee rates for transactions | `Promise<{normal: number, fast: number}>` |
| `dispose()` | Disposes all wallet accounts, clearing private keys from memory | `void` |

##### `getAccount(index)`
Returns a wallet account at the specified index.

**Parameters:**
- `index` (number, optional): The index of the account to get (default: 0)

**Returns:** `Promise<WalletAccountSolana>` - The wallet account

##### `getAccountByPath(path)`
Returns a wallet account at the specified BIP-44 derivation path.

**Parameters:**
- `path` (string): The derivation path (e.g., "0'/0/0")

**Returns:** `Promise<WalletAccountSolana>` - The wallet account

##### `getFeeRates()`
Returns current fee rates based on recent blockhash and compute unit prices.

**Returns:** `Promise<{normal: number, fast: number}>` - Object containing normal and fast fee rates in lamports

##### `dispose()`
Disposes all wallet accounts, clearing private keys from memory.

**Returns:** `void`

### WalletAccountSolana

Represents an individual Solana wallet account. Implements `IWalletAccount` from `@wdk/wallet`.

#### Constructor

```javascript
new WalletAccountSolana(seed, path, config)
```

**Parameters:**
- `seed` (string | Uint8Array): BIP-39 mnemonic seed phrase or seed bytes
- `path` (string): BIP-44 derivation path (e.g., "0'/0/0")
- `config` (object): Configuration object
  - `provider` (string | Connection): RPC endpoint URL or Solana Connection instance
  - `commitment` (string, optional): Commitment level ('processed', 'confirmed', or 'finalized')
  - `transferMaxFee` (number, optional): Maximum fee amount for transfer operations (in lamports)

#### Methods

| Method | Description | Returns |
|--------|-------------|---------|
| `getAddress()` | Returns the account's public key | `Promise<string>` |
| `sign(message)` | Signs a message using the account's private key | `Promise<string>` |
| `verify(message, signature)` | Verifies a message signature | `Promise<boolean>` |
| `sendTransaction(tx)` | Sends a Solana transaction | `Promise<{signature: string, fee: number}>` |
| `quoteSendTransaction(tx)` | Estimates the fee for a transaction | `Promise<{fee: number}>` |
| `transfer(options)` | Transfers SPL tokens to another address | `Promise<{signature: string, fee: number}>` |
| `quoteTransfer(options)` | Estimates the fee for an SPL token transfer | `Promise<{fee: number}>` |
| `getBalance()` | Returns the native SOL balance (in lamports) | `Promise<number>` |
| `getTokenBalance(tokenMint)` | Returns the balance of a specific SPL token | `Promise<number>` |
| `dispose()` | Disposes the wallet account, clearing private keys from memory | `void` |

##### `sendTransaction(tx)`
Sends a Solana transaction.

**Parameters:**
- `tx` (object): The transaction object
  - `recipient` (string): Recipient's public key (base58-encoded)
  - `value` (number): Amount in lamports
  - `commitment` (string, optional): Commitment level

**Returns:** `Promise<{signature: string, fee: number}>` - Object containing signature and fee (in lamports)

##### `quoteSendTransaction(tx)`
Estimates the fee for a Solana transaction.

**Parameters:**
- `tx` (object): The transaction object (same as sendTransaction)
  - `recipient` (string): Recipient's public key (base58-encoded)
  - `value` (number): Amount in lamports
  - `commitment` (string, optional): Commitment level

**Returns:** `Promise<{fee: number}>` - Object containing fee estimate (in lamports)

##### `transfer(options)`
Transfers SPL tokens to another address.

**Parameters:**
- `options` (object): Transfer options
  - `token` (string): Token mint address (base58-encoded)
  - `recipient` (string): Recipient's public key (base58-encoded)
  - `amount` (number): Amount in token's base units
  - `commitment` (string, optional): Commitment level

**Returns:** `Promise<{signature: string, fee: number}>` - Object containing signature and fee (in lamports)

##### `quoteTransfer(options)`
Estimates the fee for an SPL token transfer.

**Parameters:**
- `options` (object): Transfer options (same as transfer)
  - `token` (string): Token mint address (base58-encoded)
  - `recipient` (string): Recipient's public key (base58-encoded)
  - `amount` (number): Amount in token's base units
  - `commitment` (string, optional): Commitment level

**Returns:** `Promise<{fee: number}>` - Object containing fee estimate (in lamports)

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `index` | `number` | The derivation path's index of this account |
| `path` | `string` | The full derivation path of this account |
| `keyPair` | `Ed25519Keypair` | The account's Ed25519 key pair (⚠️ Contains sensitive data) |

⚠️ **Security Note**: The `keyPair` property contains sensitive cryptographic material. Never log, display, or expose the private key.

### WalletAccountReadOnlySolana

Represents a read-only Solana wallet account.

#### Constructor

```javascript
new WalletAccountReadOnlySolana(publicKey, config)
```

**Parameters:**
- `publicKey` (string): The account's public key (base58-encoded)
- `config` (object): Configuration object
  - `provider` (string | Connection): RPC endpoint URL or Solana Connection instance
  - `commitment` (string, optional): Commitment level ('processed', 'confirmed', or 'finalized')

#### Methods

| Method | Description | Returns |
|--------|-------------|---------|
| `getBalance()` | Returns the native SOL balance (in lamports) | `Promise<number>` |
| `getTokenBalance(tokenMint)` | Returns the balance of a specific SPL token | `Promise<number>` |
| `quoteSendTransaction(tx)` | Estimates the fee for a transaction | `Promise<{fee: number}>` |
| `quoteTransfer(options)` | Estimates the fee for an SPL token transfer | `Promise<{fee: number}>` |

##### `getBalance()`
Returns the native SOL balance.

**Returns:** `Promise<number>` - Balance in lamports

##### `getTokenBalance(tokenMint)`
Returns the balance of a specific SPL token.

**Parameters:**
- `tokenMint` (string): Token mint address (base58-encoded)

**Returns:** `Promise<number>` - Token balance in base units

##### `quoteSendTransaction(tx)`
Estimates the fee for a transaction.

**Parameters:**
- `tx` (object): The transaction object
  - `recipient` (string): Recipient's public key (base58-encoded)
  - `value` (number): Amount in lamports
  - `commitment` (string, optional): Commitment level

**Returns:** `Promise<{fee: number}>` - Object containing fee estimate (in lamports)

##### `quoteTransfer(options)`
Estimates the fee for an SPL token transfer.

**Parameters:**
- `options` (object): Transfer options
  - `token` (string): Token mint address (base58-encoded)
  - `recipient` (string): Recipient's public key (base58-encoded)
  - `amount` (number): Amount in token's base units
  - `commitment` (string, optional): Commitment level

**Returns:** `Promise<{fee: number}>` - Object containing fee estimate (in lamports)

## 🌐 Supported Networks

This package works with the Solana blockchain, including:

- **Solana Mainnet Beta**
  - RPC: https://api.mainnet-beta.solana.com
  - Explorer: https://explorer.solana.com
- **Solana Testnet**
  - RPC: https://api.testnet.solana.com
  - Explorer: https://explorer.solana.com?cluster=testnet
- **Solana Devnet**
  - RPC: https://api.devnet.solana.com
  - Explorer: https://explorer.solana.com?cluster=devnet

## 🔒 Security Considerations

- **Seed Phrase Security**: Always store your seed phrase securely and never share it
- **Private Key Management**: The package handles private keys internally with Ed25519 memory safety features
- **Provider Security**: 
  - Use trusted RPC endpoints
  - Consider running your own Solana validator for production
  - Be aware of rate limits on public RPC endpoints
- **Transaction Validation**:
  - Always validate transaction details before signing
  - Verify recent blockhash is not expired
  - Check commitment levels for finality
- **Memory Cleanup**: Use the `dispose()` method to clear private keys from memory when done
- **Fee Limits**: 
  - Set `transferMaxFee` to prevent excessive transaction fees
  - Account for rent-exempt minimums in transfers
- **Token Safety**:
  - Verify token mint addresses carefully
  - Check token decimals before transfers
  - Be aware of Associated Token Account creation costs
- **Program Interaction**:
  - Validate program IDs before interaction
  - Understand instruction data formats
  - Test complex transactions in devnet first

## 🛠️ Development

### Building

```bash
# Install dependencies
npm install

# Build TypeScript definitions
npm run build:types

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix
```

### Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## 💡 Examples

### Complete Wallet Setup

```javascript
import WalletManagerSolana from '@wdk/wallet-solana'

async function setupWallet() {
  // Use a BIP-39 seed phrase (replace with your own secure phrase)
  const seedPhrase = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
  
  // Create wallet manager
  const wallet = new WalletManagerSolana(seedPhrase, {
    provider: 'https://api.mainnet-beta.solana.com',
    commitment: 'confirmed'
  })
  
  // Get first account
  const account = await wallet.getAccount(0)
  const address = await account.getAddress()
  console.log('Wallet address:', address)
  
  // Check balance
  const balance = await account.getBalance()
  console.log('Balance:', balance, 'lamports')
  
  return { wallet, account, address, balance }
}
```

### Multi-Account Management

```javascript
async function manageMultipleAccounts(wallet) {
  const accounts = []
  
  // Create 5 accounts
  for (let i = 0; i < 5; i++) {
    const account = await wallet.getAccount(i)
    const address = await account.getAddress()
    const balance = await account.getBalance()
    
    accounts.push({
      index: i,
      address,
      balance
    })
  }
  
  return accounts
}
```

## 📜 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 🆘 Support

For support, please open an issue on the GitHub repository.

---

**Note**: This package is currently in beta. Please test thoroughly in development environments before using in production.