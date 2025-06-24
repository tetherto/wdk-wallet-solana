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

## Running Tests

The test suite uses Jest and requires a local Solana validator to be running. There are two ways to run the tests:

```bash
npm test
```


### Additional Test Commands

- Run tests with coverage:
```bash
npm run test:coverage
```

## Available Scripts

- `npm run build:types` - Generate TypeScript type definitions
- `npm run lint` - Run linting checks
- `npm run lint:fix` - Fix linting issues automatically
- `npm run test` - Run tests
- `npm run test:coverage` - Run tests with coverage report


