# wdk-wallet-solana Test Setup

This guide explains how to set up your local development environment to run tests for the `WalletManagerSolana` module.

---

## Prerequisites

Ensure the following tools are installed:

- [**Node.js**](https://nodejs.org/) ≥ 18
- **Solana CLI Tools** (`solana`, `solana-test-validator`)
- `` or `` for dependency management

---

## Environment Configuration

You may optionally define a `.env` file in the root directory, although not strictly required unless you introduce additional test configurations.

---

## Automated Test Setup & Teardown

Running the test suite will automatically:

- Start a clean `solana-test-validator` in local mode
- Reset the test ledger
- Shut down and clean up the validator environment after tests finish

### Skip Automatic Setup

To **skip setup** and use your own running validator:

```bash
SKIP_SETUP=1 npm run test
```

To **skip teardown** and inspect the environment after test failures:

```bash
SKIP_TEARDOWN=1 npm run test
```

---

## (Optional) Manual Setup & Teardown

You can run the Solana local validator manually if you want to debug or inspect it during/after tests.

### Step 1: Run Solana Validator

```bash
solana-test-validator --reset
```

This will start a fresh local blockchain. You can keep this running in the background for debugging.

---

### Step 2: Clean Up Manually

To ensure a clean test state:

```bash
pkill -f solana-test-validator
rm -rf ~/.local/share/solana/test-ledger
```

---

## Running Tests

Run all unit tests using:

```bash
npm test
```

To include a coverage report:

```bash
npm run test:coverage
```

---

## Troubleshooting

### Validator fails to start

1. Kill existing processes:

   ```bash
   pkill -f solana-test-validator
   ```

2. Clean up leftover ledger files:

   ```bash
   rm -rf ~/.local/share/solana/test-ledger
   ```

3. Restart validator manually:

   ```bash
   solana-test-validator --reset
   ```

4. Check for logs:

   ```bash
   cat ~/.local/share/solana/test-ledger/validator.log
   ```

---

### Solana CLI not found

Make sure Solana is installed and in your `$PATH`.

Check with:

```bash
which solana
which solana-test-validator
```

If missing, follow [installation instructions](https://docs.solana.com/cli/install-solana-cli-tools) or use:

```bash
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
```

Then add to your shell profile:

```bash
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
```

And reload:

```bash
source ~/.bashrc # or ~/.zshrc
```

---


