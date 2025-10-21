# @tetherto/wdk-wallet-solana

**Note**: This package is currently in beta. Please test thoroughly in development environments before using in production.

A simple and secure package to manage BIP-44 wallets for the Solana blockchain. This package provides a clean API for creating, managing, and interacting with Solana wallets using BIP-39 seed phrases and Solana-specific derivation paths.

## 🔍 About WDK

This module is part of the [**WDK (Wallet Development Kit)**](https://wallet.tether.io/) project, which empowers developers to build secure, non-custodial wallets with unified blockchain access, stateless architecture, and complete user control. 

For detailed documentation about the complete WDK ecosystem, visit [docs.wallet.tether.io](https://docs.wallet.tether.io).

## 🌟 Features

- **Solana Derivation Paths**: Support for BIP-44 standard derivation paths for Solana (m/44'/501')
- **Multi-Account Management**: Create and manage multiple accounts from a single seed phrase
- **Transaction Management**: Send transactions and get fee estimates with recent blockhash
- **SPL Token Support**: Query native SOL and SPL token balances using program interactions

## ⬇️ Installation

To install the `@tetherto/wdk-wallet-solana` package, follow these instructions:

You can install it using npm:

```bash
npm install @tetherto/wdk-wallet-solana
```

## 🚀 Quick Start

### Importing from `@tetherto/wdk-wallet-solana`

1. WalletManagerSolana: Main class for managing wallets
2. WalletAccountSolana: Use this for full access accounts
3. WalletAccountReadOnlySolana: Use this for read-only accounts

### Creating a New Wallet

```javascript
import WalletManagerSolana, { 
  WalletAccountSolana, 
  WalletAccountReadOnlySolana 
} from '@tetherto/wdk-wallet-solana'

// Use a BIP-39 seed phrase (replace with your own secure phrase)
const seedPhrase = 'test only example nut use this real life secret phrase must random'

// Create wallet manager with Solana RPC provider
const wallet = new WalletManagerSolana(seedPhrase, {
  rpcUrl: 'https://api.mainnet-beta.solana.com', // or any Solana RPC endpoint
  commitment: 'confirmed' // Optional: commitment level
})

// Get a full access account
const account = await wallet.getAccount(0)

// Convert to a read-only account
const readOnlyAccount = await account.toReadOnlyAccount()
```

### Managing Multiple Accounts

```javascript
import WalletManagerSolana from '@tetherto/wdk-wallet-solana'

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
import WalletManagerSolana from '@tetherto/wdk-wallet-solana'

// Assume wallet and account are already created
// Get native SOL balance (in lamports)
const balance = await account.getBalance()
console.log('Native balance:', balance, 'lamports') // 1 SOL = 1000000000 lamports

// Get SPL token balance
const tokenMint = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'; // USDT mint address
const tokenBalance = await account.getTokenBalance(tokenMint);
console.log('Token balance:', tokenBalance);

// Note: Provider is required for balance checks
// Make sure wallet was created with a provider configuration
```

#### Read-Only Account

For addresses where you don't have the seed phrase:

```javascript
import { WalletAccountReadOnlySolana } from '@tetherto/wdk-wallet-solana'

// Create a read-only account
const readOnlyAccount = new WalletAccountReadOnlySolana('publicKey', { // Base58-encoded public key
  rpcUrl: 'https://api.mainnet-beta.solana.com',
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

- Send SOL and estimate fees

```javascript
// Send native SOL
const result = await account.sendTransaction({
  to: 'recipientPublicKey', // Recipient's base58-encoded public key
  value: 1000000000n // 1 SOL in lamports (use BigInt)
})
console.log('Transaction hash:', result.hash)
console.log('Transaction fee:', result.fee, 'lamports')

// Quote transaction fee before sending
const quote = await account.quoteSendTransaction({
  to: 'recipientPublicKey',
  value: 1000000000n
})
console.log('Estimated fee:', quote.fee, 'lamports')
```

- Send Solana Transaction Message

```javascript
import { 
  createTransactionMessage, 
  pipe, 
  appendTransactionMessageInstruction 
} from '@solana/kit'
import { getTransferSolInstruction } from '@solana-program/system'

// Build a TransactionMessage with custom instructions
const fromAddress = await account.getAddress()

const transferInstruction = getTransferSolInstruction({
  source: { address: fromAddress },
  destination: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
  amount: 1000000n
})

const txMessage = pipe(
  createTransactionMessage({ version: 0 }),
  tx => appendTransactionMessageInstruction(transferInstruction, tx)
)

const result = await account.sendTransaction(txMessage)
console.log('Transaction hash:', result.hash)
```

### Token Transfers

Transfer SPL tokens and estimate fees using `WalletAccountSolana`. Uses Token Program instructions.

```javascript
// Transfer SPL tokens
const transferResult = await account.transfer({
  token: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // Token mint address
  recipient: 'publicKey',  // Recipient's base58-encoded public key
  amount: 1000000n     // Amount in token's base units (use BigInt for large numbers)
}, {
  commitment: 'confirmed' // Optional: commitment level
});
console.log('Transaction signature:', transferResult.signature);
console.log('Transfer fee:', transferResult.fee, 'lamports');

// Quote token transfer fee
const transferQuote = await account.quoteTransfer({
  token: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // Token mint address
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
| [WalletManagerSolana](#walletmanagersolana) | Main class for managing Solana wallets. Extends `WalletManager` from `@tetherto/wdk-wallet`. | [Constructor](#constructor), [Methods](#methods) |
| [WalletAccountSolana](#walletaccountsolana) | Individual Solana wallet account implementation. Extends `WalletAccountReadOnlySolana` and implements `IWalletAccount`. | [Constructor](#constructor-1), [Methods](#methods-1), [Properties](#properties) |
| [WalletAccountReadOnlySolana](#walletaccountreadonlysolana) | Read-only Solana wallet account. | [Constructor](#constructor-2), [Methods](#methods-2) |

### WalletManagerSolana

The main class for managing Solana wallets.  
Extends `WalletManager` from `@tetherto/wdk-wallet`.

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
  rpcUrl: 'https://api.mainnet-beta.solana.com',
  commitment: 'confirmed',
  transferMaxFee: 5000 // Maximum fee in lamports
})
```

#### Methods

| Method | Description | Returns |
|--------|-------------|---------|
| `getAccount(index)` | Returns a wallet account at the specified index | `Promise<WalletAccountSolana>` |
| `getAccountByPath(path)` | Returns a wallet account at the specified BIP-44 derivation path | `Promise<WalletAccountSolana>` |
| `getFeeRates()` | Returns current fee rates for transactions | `Promise<{normal: bigint, fast: bigint}>` |
| `dispose()` | Disposes all wallet accounts, clearing private keys from memory | `void` |

##### `getAccount(index)`
Returns a Solana wallet account at the specified index using BIP-44 derivation path m/44'/501'.

**Parameters:**
- `index` (number, optional): The index of the account to get (default: 0)

**Returns:** `Promise<WalletAccountSolana>` - The Solana wallet account

**Example:**
```javascript
const account = await wallet.getAccount(0)
const address = await account.getAddress()
console.log('Solana account address:', address)
```

##### `getAccountByPath(path)`
Returns a Solana wallet account at the specified BIP-44 derivation path.

**Parameters:**
- `path` (string): The derivation path (e.g., "0'/0/0", "1'/0/5")

**Returns:** `Promise<WalletAccountSolana>` - The Solana wallet account

**Example:**
```javascript
const account = await wallet.getAccountByPath("0'/0/1")
const address = await account.getAddress()
console.log('Custom path address:', address)
```

##### `getFeeRates()`
Returns current fee rates for Solana transactions from the network.

**Returns:** `Promise<{normal: bigint, fast: bigint}>` - Object containing fee rates in lamports
- `normal`: Standard compute unit price for normal confirmation speed
- `fast`: Priority compute unit price for faster confirmation

**Example:**
```javascript
const feeRates = await wallet.getFeeRates()
console.log('Normal fee rate:', feeRates.normal, 'lamports')
console.log('Fast fee rate:', feeRates.fast, 'lamports')

// Use in transaction
const result = await account.sendTransaction({
  recipient: '11111111111111111111111111111112',
  value: 1000000000n // 1 SOL in lamports
})
```

##### `dispose()`
Disposes all Solana wallet accounts and clears sensitive data from memory.

**Returns:** `void`

**Example:**
```javascript
wallet.dispose()
// All accounts and private keys are now securely wiped from memory
```

### WalletAccountSolana

Represents an individual Solana wallet account. Implements `IWalletAccount` from `@tetherto/wdk-wallet`.

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
| `sendTransaction(tx)` | Sends a Solana transaction | `Promise<{signature: string, fee: bigint}>` |
| `quoteSendTransaction(tx)` | Estimates the fee for a transaction | `Promise<{fee: bigint}>` |
| `transfer(options)` | Transfers SPL tokens to another address | `Promise<{signature: string, fee: bigint}>` |
| `quoteTransfer(options)` | Estimates the fee for an SPL token transfer | `Promise<{fee: bigint}>` |
| `getBalance()` | Returns the native SOL balance (in lamports) | `Promise<bigint>` |
| `getTokenBalance(tokenMint)` | Returns the balance of a specific SPL token | `Promise<bigint>` |
| `dispose()` | Disposes the wallet account, clearing private keys from memory | `void` |

##### `getAddress()`
Returns the account's Solana public key (base58-encoded).

**Returns:** `Promise<string>` - The account's public key

**Example:**
```javascript
const address = await account.getAddress()
console.log('Solana address:', address) // Base58 public key
```

##### `sign(message)`
Signs a message using the account's Ed25519 private key.

**Parameters:**
- `message` (string): Message to sign

**Returns:** `Promise<string>` - Signature as base58 string

**Example:**
```javascript
const signature = await account.sign('Hello Solana!')
console.log('Signature:', signature)
```

##### `verify(message, signature)`
Verifies a message signature using the account's Ed25519 public key.

**Parameters:**
- `message` (string): Original message
- `signature` (string): Signature as base58 string

**Returns:** `Promise<boolean>` - True if signature is valid

**Example:**
```javascript
const isValid = await account.verify('Hello Solana!', signature)
console.log('Signature valid:', isValid)
```

##### `sendTransaction(tx)`
Sends a Solana transaction and broadcasts it to the network.

**Parameters:**
- `tx` (object): The transaction object
  - `recipient` (string): Recipient's public key (base58-encoded)
  - `value` (number | bigint): Amount in lamports
  - `commitment` (string, optional): Commitment level ('processed', 'confirmed', 'finalized')

**Returns:** `Promise<{signature: string, fee: bigint}>` - Object containing signature and fee (in lamports)

**Example:**
```javascript
const result = await account.sendTransaction({
  recipient: '11111111111111111111111111111112',
  value: 1000000000n, // 1 SOL in lamports
  commitment: 'confirmed'
})
console.log('Transaction signature:', result.signature)
console.log('Fee paid:', result.fee, 'lamports')
```

##### `quoteSendTransaction(tx)`
Estimates the fee for a Solana transaction without broadcasting it.

**Parameters:**
- `tx` (object): Same as sendTransaction parameters
  - `recipient` (string): Recipient's public key (base58-encoded)
  - `value` (number | bigint): Amount in lamports
  - `commitment` (string, optional): Commitment level

**Returns:** `Promise<{fee: bigint}>` - Object containing estimated fee (in lamports)

**Example:**
```javascript
const quote = await account.quoteSendTransaction({
  recipient: '11111111111111111111111111111112',
  value: 1000000000n // 1 SOL in lamports
})
console.log('Estimated fee:', quote.fee, 'lamports')
console.log('Estimated fee in SOL:', Number(quote.fee) / 1e9)
```

##### `transfer(options)`
Transfers SPL tokens to another address and broadcasts the transaction.

**Parameters:**
- `options` (object): Transfer options
  - `token` (string): Token mint address (base58-encoded)
  - `recipient` (string): Recipient's public key (base58-encoded)
  - `amount` (number | bigint): Amount in token's smallest unit
  - `commitment` (string, optional): Commitment level

**Returns:** `Promise<{signature: string, fee: bigint}>` - Object containing signature and fee (in lamports)

**Example:**
```javascript
const result = await account.transfer({
  token: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
  recipient: '11111111111111111111111111111112',
  amount: 1000000n, // 1 USDT (6 decimals)
  commitment: 'confirmed'
})
console.log('Transfer signature:', result.signature)
console.log('Gas fee:', result.fee, 'lamports')
```

##### `quoteTransfer(options)`
Estimates the fee for an SPL token transfer without broadcasting it.

**Parameters:**
- `options` (object): Same as transfer parameters
  - `token` (string): Token mint address (base58-encoded)
  - `recipient` (string): Recipient's public key (base58-encoded)
  - `amount` (number | bigint): Amount in token's smallest unit
  - `commitment` (string, optional): Commitment level

**Returns:** `Promise<{fee: bigint}>` - Object containing estimated fee (in lamports)

**Example:**
```javascript
const quote = await account.quoteTransfer({
  token: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
  recipient: '11111111111111111111111111111112',
  amount: 1000000n // 1 USDT (6 decimals)
})
console.log('Estimated transfer fee:', quote.fee, 'lamports')
```

##### `getBalance()`
Returns the account's native SOL balance in lamports.

**Returns:** `Promise<bigint>` - Balance in lamports

**Example:**
```javascript
const balance = await account.getBalance()
console.log('SOL balance:', balance, 'lamports')
console.log('Balance in SOL:', Number(balance) / 1e9)
```

##### `getTokenBalance(tokenMint)`
Returns the balance of a specific SPL token.

**Parameters:**
- `tokenMint` (string): The SPL token mint address (base58-encoded)

**Returns:** `Promise<bigint>` - Token balance in token's smallest unit

**Example:**
```javascript
// Get USDT balance (6 decimals)
const usdtBalance = await account.getTokenBalance('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB')
console.log('USDT balance:', Number(usdtBalance) / 1e6)
```

##### `dispose()`
Disposes the wallet account, securely erasing the private key from memory.

**Returns:** `void`

**Example:**
```javascript
account.dispose()
// Private key is now securely wiped from memory
```


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
| `getBalance()` | Returns the native SOL balance (in lamports) | `Promise<bigint>` |
| `getTokenBalance(tokenMint)` | Returns the balance of a specific SPL token | `Promise<bigint>` |
| `quoteSendTransaction(tx)` | Estimates the fee for a transaction | `Promise<{fee: bigint}>` |
| `quoteTransfer(options)` | Estimates the fee for an SPL token transfer | `Promise<{fee: bigint}>` |

##### `getBalance()`
Returns the account's native SOL balance in lamports.

**Returns:** `Promise<bigint>` - Balance in lamports

**Example:**
```javascript
const balance = await readOnlyAccount.getBalance()
console.log('SOL balance:', balance, 'lamports')
console.log('Balance in SOL:', Number(balance) / 1e9)
```

##### `getTokenBalance(tokenMint)`
Returns the balance of a specific SPL token.

**Parameters:**
- `tokenMint` (string): The SPL token mint address (base58-encoded)

**Returns:** `Promise<bigint>` - Token balance in token's smallest unit

**Example:**
```javascript
// Get USDT balance (6 decimals)
const usdtBalance = await readOnlyAccount.getTokenBalance('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB')
console.log('USDT balance:', Number(usdtBalance) / 1e6)
```

##### `quoteSendTransaction(tx)`
Estimates the fee for a Solana transaction without broadcasting it.

**Parameters:**
- `tx` (object): The transaction object
  - `recipient` (string): Recipient's public key (base58-encoded)
  - `value` (number | bigint): Amount in lamports
  - `commitment` (string, optional): Commitment level

**Returns:** `Promise<{fee: bigint}>` - Object containing estimated fee (in lamports)

**Example:**
```javascript
const quote = await readOnlyAccount.quoteSendTransaction({
  recipient: '11111111111111111111111111111112',
  value: 1000000000n, // 1 SOL in lamports
  commitment: 'confirmed'
})
console.log('Estimated fee:', quote.fee, 'lamports')
console.log('Estimated fee in SOL:', Number(quote.fee) / 1e9)
```

##### `quoteTransfer(options)`
Estimates the fee for an SPL token transfer without broadcasting it.

**Parameters:**
- `options` (object): Transfer options
  - `token` (string): Token mint address (base58-encoded)
  - `recipient` (string): Recipient's public key (base58-encoded)
  - `amount` (number | bigint): Amount in token's smallest unit
  - `commitment` (string, optional): Commitment level

**Returns:** `Promise<{fee: bigint}>` - Object containing estimated fee (in lamports)

**Example:**
```javascript
const quote = await readOnlyAccount.quoteTransfer({
  token: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
  recipient: '11111111111111111111111111111112',
  amount: 1000000n, // 1 USDT (6 decimals)
  commitment: 'confirmed'
})
console.log('Estimated transfer fee:', quote.fee, 'lamports')
console.log('Estimated fee in SOL:', Number(quote.fee) / 1e9)
```

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


## 📜 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 🆘 Support

For support, please open an issue on the GitHub repository.

---
