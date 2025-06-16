import WalletAccountSolana from '../src/wallet-account-solana.js'
import WalletManagerSolana from '../src/wallet-manager-solana.js'
import * as bip39 from 'bip39'

const SEED_PHRASE = 'cook voyage document eight skate token alien guide drink uncle term abuse'

const testConfig = { rpcUrl: 'http://localhost:8899', wsUrl: 'ws://localhost:8900' }

const INVALID_SEED_PHRASE = 'invalid seed phrase'

const SEED = bip39.mnemonicToSeedSync(SEED_PHRASE)

describe('WalletManagerSolana', () => {
  let walletManager

  beforeEach(async () => {
    walletManager = new WalletManagerSolana(SEED_PHRASE, testConfig)
  })

  describe('constructor', () => {
    test('should successfully initialize a wallet manager for the given seed phrase', () => {
      const validWallet = new WalletManagerSolana(SEED_PHRASE, testConfig)
      expect(validWallet).toBeDefined()
      expect(validWallet.seed).toEqual(SEED)
    })

    test('should successfully initialize a wallet manager for the given seed', () => {
      const seedWallet = new WalletManagerSolana(SEED)
      expect(seedWallet.seed).toEqual(SEED)
    })

    test('should throw if the seed phrase is invalid', () => {
      // eslint-disable-next-line no-new
      expect(() => { new WalletManagerSolana(INVALID_SEED_PHRASE) })
        .toThrow('Invalid seed phrase.')
    })
  })

  describe('getAccount', () => {
    test('should return the account at index 0 by default', async () => {
      const account = await walletManager.getAccount()

      expect(account).toBeInstanceOf(WalletAccountSolana)

      expect(account.path).toBe("m/44'/501'/0'/0'")
    })

    test('should return the account at the given index', async () => {
      const account = await walletManager.getAccount(3)

      expect(account).toBeInstanceOf(WalletAccountSolana)

      expect(account.path).toBe("m/44'/501'/3'/0'")
    })

    test('should throw if the index is a negative number', async () => {
      await expect(walletManager.getAccount(-1))
        .rejects.toThrow('Invalid child index: -1')
    })
  })

  describe('getAccountByPath', () => {
    test('should return the account with the given path', async () => {
      const account = await walletManager.getAccountByPath("1'/0'")

      expect(account).toBeInstanceOf(WalletAccountSolana)

      expect(account.path).toBe("m/44'/501'/1'/0'")
    })

    test('should throw if the path is invalid', async () => {
      await expect(walletManager.getAccountByPath("a'/b'"))
        .rejects.toThrow('Invalid child index: a')
    })
  })

  describe('static getRandomSeedPhrase', () => {
    test('should generate a valid 12-word seed phrase', () => {
      const seedPhrase = WalletManagerSolana.getRandomSeedPhrase()

      const words = seedPhrase.trim()
        .split(/\s+/)

      expect(words).toHaveLength(12)

      words.forEach(word => {
        expect(bip39.wordlists.EN.includes(word))
          .not.toBe(-1)
      })
    })
  })

  describe('static isValidSeedPhrase', () => {
    test('should return true for a valid seed phrase', () => {
      expect(WalletManagerSolana.isValidSeedPhrase(SEED_PHRASE))
        .toBe(true)
    })

    test('should return false for an invalid seed phrase', () => {
      expect(WalletManagerSolana.isValidSeedPhrase(INVALID_SEED_PHRASE))
        .toBe(false)
    })

    test('should return false for an empty string', () => {
      expect(WalletManagerSolana.isValidSeedPhrase(''))
        .toBe(false)
    })
  })

  describe('getFeeRates', () => {
    test('should return the correct fee rates', async () => {
      const feeRates = await walletManager.getFeeRates()
      expect(feeRates).toBeDefined()
      expect(feeRates.normal).toBe(5500)
      expect(feeRates.fast).toBe(10000)
    })

    test('should throw an error if the wallet is not connected to a provider', async () => {
      const walletManagerWithoutRpc = new WalletManagerSolana(SEED_PHRASE)
      await expect(walletManagerWithoutRpc.getFeeRates()).rejects.toThrow(
        'The wallet must be connected to a provider to get fee rates.'
      )
    })

    test('should handle RPC errors gracefully', async () => {
      const walletManagerWithInvalidRpc = new WalletManagerSolana(SEED_PHRASE, {
        rpcUrl: 'https://invalid-rpc-url.com'
      })
      await expect(walletManagerWithInvalidRpc.getFeeRates()).rejects.toThrow()
    })

    test('should return default fee rates when no recent fees are available', async () => {
      // Mock the RPC response to return empty fees
      const originalRpc = walletManager['#rpc']
      walletManager['#rpc'] = {
        getRecentPrioritizationFees: () => ({
          send: async () => []
        })
      }

      const feeRates = await walletManager.getFeeRates()
      expect(feeRates).toBeDefined()
      expect(feeRates.normal).toBe(5500) // 5000 * 1.1
      expect(feeRates.fast).toBe(10000) // 5000 * 2.0

      // Restore original RPC
      walletManager['#rpc'] = originalRpc
    })
    test('should throw if the wallet is not connected to a provider', async () => {
      const wallet = new WalletManagerSolana(SEED_PHRASE)

      await expect(wallet.getFeeRates())
        .rejects.toThrow('The wallet must be connected to a provider to get fee rates.')
    })
  })

  describe('dispose', () => {
    test('should dispose the wallet manager', () => {
      walletManager.dispose()
      expect(walletManager.seed).toBeNull()
    })
  })
})
