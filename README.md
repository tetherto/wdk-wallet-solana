# WDK Wallet Solana

WDK package to manage Solana wallets.

## Prerequisites

- Node.js (v16 or higher)
- npm (v7 or higher)
- Solana CLI tools (for local development and testing)


## Development Setup

1. Clone the repository:
```bash
git clone https://github.com/tetherto/wdk-wallet-solana.git
cd wdk-wallet-solana
```

2. Install dependencies:
```bash
npm install
```

3. Install Solana CLI tools:

   a. Install Solana CLI:
   ```bash
   sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
   ```

   b. Add Solana to your PATH:
   ```bash
   # For bash users
   echo 'export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"' >> ~/.bash_profile
   source ~/.bash_profile

   # For zsh users
   echo 'export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"' >> ~/.zshrc
   source ~/.zshrc
   ```

   c. Verify installation:
   ```bash
   solana --version
   solana-test-validator --version
   ```

## Running Tests

The test suite uses Jest and requires a local Solana validator to be running. There are two ways to run the tests:

### Method 1: Using npm scripts (Recommended)

1. Start the Solana validator in a separate terminal:
```bash
npm run test:validator
```

2. In another terminal, run the tests:
```bash
npm test
```

### Method 2: Using test:setup script

This will start the validator and run tests in a single command:
```bash
npm run test:setup
```

### Additional Test Commands

- Run tests in watch mode:
```bash
npm run test:watch
```

- Run tests with coverage:
```bash
npm run test:coverage
```

## Available Scripts

- `npm run build:types` - Generate TypeScript type definitions
- `npm run lint` - Run linting checks
- `npm run lint:fix` - Fix linting issues automatically
- `npm run test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report
- `npm run test:validator` - Start the Solana test validator
- `npm run test:setup` - Start validator and run tests

## Troubleshooting

### Solana CLI Installation Issues

If you encounter issues installing Solana CLI tools:

1. Ensure you have the correct PATH:
   ```bash
   # Check if Solana is in your PATH
   which solana
   which solana-test-validator
   ```

2. If not found, manually add to PATH:
   ```bash
   export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
   ```

3. Verify the installation directory exists:
   ```bash
   ls -la ~/.local/share/solana/install/active_release/bin
   ```

4. If installation fails, try manual installation:
   ```bash
   # Download the latest release
   curl -L https://github.com/solana-labs/solana/releases/latest/download/solana-release-x86_64-apple-darwin.tar.bz2 -o solana-release.tar.bz2
   
   # Extract and install
   tar -xjf solana-release.tar.bz2
   mkdir -p ~/.local/share/solana/install/active_release/bin
   cp solana-release/bin/* ~/.local/share/solana/install/active_release/bin/
   ```

### Validator Issues

If you encounter issues with the Solana validator:

1. Check if there are any existing validator processes:
```bash
ps aux | grep solana-test-validator
```

2. Kill any existing validator processes:
```bash
pkill -f solana-test-validator
```

3. Clean up the test ledger:
```bash
rm -rf ~/.local/share/solana/test-ledger*
```

4. Restart the validator:
```bash
npm run validator
```

5. If validator fails to start, check logs:
```bash
cat ~/.local/share/solana/test-ledger/validator.log
```
