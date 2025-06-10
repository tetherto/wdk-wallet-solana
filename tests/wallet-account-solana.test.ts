
import { createTestToken } from './tokenBasic.js';
import WalletAccountSolana from '../src/wallet-account-solana.js';
import * as bip39 from "bip39";
const SEED_PHRASE = 'uncover learn cheese meat fire tired enact melt heart million soda zebra'
const VALID_SEED = bip39.mnemonicToSeedSync(SEED_PHRASE);
const VALID_PATH = "0'/0'";
const VALID_CONFIG = { rpcUrl: 'http://localhost:8899', wsUrl: 'ws://localhost:8900' }; // Use solana-test-validator RPC
const VALID_ADDRESS = '9gT8yrFzG7e23NE4hRGMoPPBuaNjVKnp8pdH7HkjJnY2';
let VALID_TOKEN = 'DMRZSW4YF53uenPDG3bmhjxksGzkFgunzXVWeb87C6bk';

describe('WalletAccountSolana', () => {
    let wallet: WalletAccountSolana;

    beforeAll(async () => {
        const tokenMint = await createTestToken(SEED_PHRASE, VALID_ADDRESS);
        if (!tokenMint) {
            throw new Error('Failed to create test token');
        }
        VALID_TOKEN = tokenMint;
        console.log('VALID_TOKEN', VALID_TOKEN);
    });

    beforeEach(async () => {
        wallet = await WalletAccountSolana.create(VALID_SEED, VALID_PATH, VALID_CONFIG);
    });

    describe('initialization', () => {
        it('should create a new wallet instance', () => {
            expect(wallet).toBeDefined();
            expect(wallet).toBeInstanceOf(WalletAccountSolana);
        });

        it('should have correct path', () => {
            expect(wallet.path).toBe("m/44'/501'/0'/0'");
        });

        it('should have valid key pair', () => {
            const keyPair = wallet.keyPair;
            expect(keyPair).toBeDefined();
            expect(keyPair.privateKey).toBeDefined();
            expect(keyPair.publicKey).toBeDefined();
        });

        it('should initialize with seed phrase', async () => {
            const validAccount = await WalletAccountSolana.create(SEED_PHRASE, VALID_PATH, VALID_CONFIG)
            const address = await validAccount.getAddress()
            expect(address).toBe(VALID_ADDRESS);
        });

        it('should throw error for invalid seed phrase', () => {
            expect(() => new WalletAccountSolana('invalid seed', VALID_PATH, VALID_CONFIG)).toThrow('The seed phrase is invalid.');
        });


    });

    describe('address', () => {
        it('should return a valid address', async () => {
            const address = await wallet.getAddress();
            expect(address).toBeDefined();
            expect(typeof address).toBe('string');
            expect(address.length).toBeGreaterThan(0);
        });

        it('should get index', () => {
            expect(wallet.index).toBe(0);
        });

        it('should throw error when getting address of uninitialized wallet', async () => {
            const walletWithoutAccount = new WalletAccountSolana(VALID_SEED, 'm/44\'/501\'/0\'/1\'');
            await expect(walletWithoutAccount.getAddress()).rejects.toThrow('The wallet must be initialized to get the address.');
        });
    });

    describe('signing', () => {
        it('should sign and verify a message', async () => {
            const message = 'Hello, Solana!';
            const signature = await wallet.sign(message);
            expect(signature).toBeDefined();
            expect(typeof signature).toBe('string');
            const isValid = await wallet.verify(message, signature);
            expect(isValid).toBe(true);
        });
        it('it should throw error when signing account is not initialized', async () => {
            const walletWithoutAccount = new WalletAccountSolana(VALID_SEED, 'm/44\'/501\'/0\'/1\'');
            await expect(walletWithoutAccount.sign('Hello, Solana!')).rejects.toThrow('The wallet must be initialized to sign messages.');
        });

        it('should fail to verify with wrong signature', async () => {
            const message = 'Hello, Solana!';
            const wrongSignature = 'wrong' + (await wallet.sign(message));
            const isValid = await wallet.verify(message, wrongSignature);
            expect(isValid).toBe(false);
        });
        it('should throw error when verifying message with uninitialized wallet', async () => {
            const walletWithoutAccount = new WalletAccountSolana(VALID_SEED, 'm/44\'/501\'/0\'/1\'');
            await expect(walletWithoutAccount.verify('Hello, Solana!', '')).rejects.toThrow('The wallet must be initialized to verify messages.');
        });
    });

    describe('transactions', () => {
        it('should quote a transaction', async () => {
            const tx = { to: VALID_ADDRESS, value: 1000000 };
            const quote = await wallet.quoteTransaction(tx);
            expect(typeof quote).toBe('number');
            expect(quote).toBeGreaterThan(0);
        });

        it('should quote a transaction with memo', async () => {
            const tx = { to: VALID_ADDRESS, value: 1000000, data: 'memo' };
            const quote = await wallet.quoteTransaction(tx);
            expect(typeof quote).toBe('number');
            expect(quote).toBeGreaterThan(0);
        });

        it('should throw error when quoting transaction with invalid rpc', async () => {
            const walletWithoutRpc = new WalletAccountSolana(VALID_SEED, VALID_PATH);
            await expect(walletWithoutRpc.quoteTransaction({ to: VALID_ADDRESS, value: 1000000 })).rejects.toThrow('The wallet must be connected to a provider to quote transactions.');
        });

        it('should throw error when quoting transaction with invalid address', async () => {
            const tx = { to: 'invalid', value: 1000000 };
            await expect(wallet.quoteTransaction(tx)).rejects.toThrow();
        });

        it('should throw error when sending transaction without RPC', async () => {
            const walletWithoutRpc = new WalletAccountSolana(VALID_SEED, VALID_PATH);
            await expect(walletWithoutRpc.sendTransaction({ to: VALID_ADDRESS, value: 1000000 })).rejects.toThrow();
        });

        it('should send a transaction with memo', async () => {
            const tx = { to: VALID_ADDRESS, value: 1000000, data: 'memo' };
            const txHash = await wallet.sendTransaction(tx);
            expect(txHash).toBeDefined();
            expect(typeof txHash).toBe('string');
        });

        it('should handle transaction errors', async () => {
            await expect(wallet.sendTransaction({ to: 'invalid', value: 1000000 })).rejects.toThrow();
        });
    });

    describe('balance', () => {
        it('should get wallet balance', async () => {
            const balance = await wallet.getBalance();
            expect(typeof balance).toBe('number');
            expect(balance).toBeGreaterThanOrEqual(0);
        });

        it('should throw error when getting balance without RPC', async () => {
            const walletWithoutRpc = new WalletAccountSolana(VALID_SEED, VALID_PATH);
            await expect(walletWithoutRpc.getBalance()).rejects.toThrow('The wallet must be connected to a provider to retrieve balances.');
        });
    });

    describe('token operations', () => {
        it('should get token balance', async () => {
            const balance = await wallet.getTokenBalance(VALID_TOKEN);
            expect(typeof balance).toBe('object');
            expect(balance.formatted).toBeGreaterThanOrEqual(0);
        });

        it('should throw error when getting token balance without RPC', async () => {
            const walletWithoutRpc = new WalletAccountSolana(VALID_SEED, VALID_PATH);
            await expect(walletWithoutRpc.getTokenBalance(VALID_TOKEN)).rejects.toThrow('The wallet must be connected to a provider to retrieve token balances.');
        });

        it('should throw error for invalid token address', async () => {
            await expect(wallet.getTokenBalance('invalid-token')).rejects.toThrow('Non-base58 character');
        });

        it('should send token transaction', async () => {
            const params = { to: VALID_ADDRESS, tokenMint: VALID_TOKEN, amount: 10 };
            const txHash = await wallet.sendTokenTransaction(params);
            expect(txHash).toBeDefined();
            expect(typeof txHash).toBe('string');
        });

        it('should throw error when sending token transaction without RPC', async () => {
            const walletWithoutRpc = new WalletAccountSolana(VALID_SEED, VALID_PATH);
            const params = { to: VALID_ADDRESS, tokenMint: VALID_TOKEN, amount: 1000000 };
            await expect(walletWithoutRpc.sendTokenTransaction(params)).rejects.toThrow('The wallet must be connected to a provider to send transactions.');
        });

        it('should handle token transaction errors', async () => {
            const params = { to: 'invalid', tokenMint: VALID_TOKEN, amount: 1000000 };
            await expect(wallet.sendTokenTransaction(params)).rejects.toThrow();
        });

        it('should throw program id error when sending token transaction', async () => {
            const params = { to: VALID_ADDRESS, tokenMint: '9gT8yrFzG7e23NE4hRGMoPPBuaNjVKnp8pdH7HkjJnY3', amount: 1000000 };
            await expect(wallet.sendTokenTransaction(params)).rejects.toThrow('Unable to determine token program ID from mint address.');
        });
    });
}); 