import WalletAccountSolana from '../src/wallet-account-solana.js'
import WalletManagerSolana from '../src/wallet-manager-solana.js'

const SEED_PHRASE = 'cook voyage document eight skate token alien guide drink uncle term abuse'

const testConfig = { rpcUrl: 'http://localhost:8899', wsUrl: 'ws://localhost:8900' }

describe('WalletManagerSolana', () => {
  let walletManager

  beforeEach(async () => {
    walletManager = new WalletManagerSolana(SEED_PHRASE, testConfig)
  })

  afterEach(() => {
    walletManager.dispose()
  })

  describe('getAccount', () => {
    test('should return the account at index 0 by default', async () => {
      const account = await walletManager.getAccount()

      expect(account).toBeInstanceOf(WalletAccountSolana)

      expect(account.path).toBe("m/44'/501'/0'/0/0")
    })

    test('should return the account at the given index', async () => {
      const account = await walletManager.getAccount(3)

      expect(account).toBeInstanceOf(WalletAccountSolana)

      expect(account.path).toBe("m/44'/501'/0'/0/3")
    })

    test('should throw if the index is a negative number', async () => {
      await expect(walletManager.getAccount(-1))
        .rejects.toThrow('Invalid child index: -1')
    })
  })

  describe('getAccountByPath', () => {
    test('should return the account with the given path', async () => {
      const account = await walletManager.getAccountByPath("0'/0/0")

      expect(account).toBeInstanceOf(WalletAccountSolana)

      expect(account.path).toBe("m/44'/501'/0'/0/0")
    })

    test('should throw if the path is invalid', async () => {
      await expect(walletManager.getAccountByPath("a'/b'"))
        .rejects.toThrow('Invalid child index: a')
    })
  })

  describe('getFeeRates', () => {
    test('should return the correct fee rates', async () => {
      const feeRates = await walletManager.getFeeRates()
      expect(feeRates).toBeDefined()
      expect(feeRates.normal).toBe(5500)
      expect(feeRates.fast).toBe(10000)
    })

    test('should throw rpc provider error', async () => {
      const feeRates = await walletManager.getFeeRates()
      expect(feeRates).toBeDefined()
      expect(feeRates.normal).toBe(5500)
      expect(feeRates.fast).toBe(10000)
    })
  })
})
