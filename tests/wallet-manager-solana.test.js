import WalletManagerSolana from '../src/wallet-manager-solana.js';

describe('WalletManagerSolana', () => {
    let walletManager;
    const testSeedPhrase = 'test test test test test test test test test test test junk';
    const testConfig = { rpcUrl: 'http://localhost:8899', wsUrl: 'ws://localhost:8900' };

    beforeEach(async () => {
        walletManager = new WalletManagerSolana(testSeedPhrase, testConfig);
    });

    describe('initialization', () => {
        it('should create a new wallet manager instance', () => {
            expect(walletManager).toBeDefined();
            expect(walletManager).toBeInstanceOf(WalletManagerSolana);
        });
    });

    describe('account management', () => {
        it('should get account by index', async () => {
            const account = await walletManager.getAccount(0);
            expect(account).toBeDefined();
            expect(account.path).toBe("m/44'/501'/0'/0'");
        });

        it('should get account by path', async () => {
            const account = await walletManager.getAccountByPath("0'/0'");
            expect(account).toBeDefined();
            expect(account.path).toBe("m/44'/501'/0'/0'");
        });


    });

    describe('seed phrase', () => {
        it('should generate a new seed phrase', () => {
            const seedPhrase = WalletManagerSolana.getRandomSeedPhrase();
            expect(seedPhrase).toBeDefined();
            expect(typeof seedPhrase).toBe('string');
            expect(seedPhrase.split(' ')).toHaveLength(12);
        });

        it('should validate a seed phrase', () => {
            expect(WalletManagerSolana.isValidSeedPhrase(testSeedPhrase)).toBe(true);
            expect(WalletManagerSolana.isValidSeedPhrase('invalid seed phrase')).toBe(false);
        });

        it(' should get the seed phrase from the wallet manager', () => {
            expect(walletManager.seedPhrase).toBeInstanceOf(Uint8Array);
        });

        it('should throw an error if the seed phrase is invalid', () => {
            expect(() => new WalletManagerSolana('invalid seed phrase', testConfig)).toThrow('The seed phrase is invalid.');
        });
    });

    describe('fee rates', () => {
        it('should get the fee rates', async () => {
            const feeRates = await walletManager.getFeeRates();
            expect(feeRates).toBeDefined();
            expect(feeRates.normal).toBeGreaterThan(0);
            expect(feeRates.fast).toBeGreaterThan(0);
            expect(feeRates.fast).toBeGreaterThan(feeRates.normal);
        });

        it('should throw an error if the wallet is not connected to a provider', async () => {
            const walletManagerWithoutRpc = new WalletManagerSolana(testSeedPhrase);
            await expect(walletManagerWithoutRpc.getFeeRates()).rejects.toThrow(
                'The wallet must be connected to a provider to get fee rates.'
            );
        });

        it('should handle RPC errors gracefully', async () => {
            const walletManagerWithInvalidRpc = new WalletManagerSolana(testSeedPhrase, {
                rpcUrl: 'https://invalid-rpc-url.com'
            });
            await expect(walletManagerWithInvalidRpc.getFeeRates()).rejects.toThrow();
        });

        it('should return default fee rates when no recent fees are available', async () => {
            // Mock the RPC response to return empty fees
            const originalRpc = walletManager['#rpc'];
            walletManager['#rpc'] = {
                getRecentPrioritizationFees: () => ({
                    send: async () => []
                })
            };

            const feeRates = await walletManager.getFeeRates();
            expect(feeRates).toBeDefined();
            expect(feeRates.normal).toBe(5500); // 5000 * 1.1
            expect(feeRates.fast).toBe(10000);  // 5000 * 2.0

            // Restore original RPC
            walletManager['#rpc'] = originalRpc;
        });
    });
}); 