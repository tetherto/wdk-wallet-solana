import { confirmTestTransaction, createTestToken, sendCoinToIndexAccount } from './tokenBasic.js'
import WalletAccountSolana from '../src/wallet-account-solana.js'
import * as bip39 from 'bip39'
const SEED_PHRASE = 'cook voyage document eight skate token alien guide drink uncle term abuse'

const VALID_SEED = bip39.mnemonicToSeedSync(SEED_PHRASE)
const VALID_PATH = "0'/0'"
const VALID_CONFIG = { rpcUrl: 'http://localhost:8899', wsUrl: 'ws://localhost:8900' } // Use solana-test-validator RPC
const VALID_ADDRESS = '8fjz5DTqBYENAUfsWLpSF2DBb46DXFcmztNJGLVrFPit'
const TO_ADDRESS = '3VbwEqWZ4C1arVkxLHNw6B7xxoGa7dsjy6mSJMWDnyYr'
const INVALID_SEED_PHRASE = 'invalid seed phrase'
const INDEX_1_ACCOUNT_PATH = "1'/0'"

const ACCOUNT = {
  index: 0,
  path: "m/44'/501'/0'/0'",
  address: '8fjz5DTqBYENAUfsWLpSF2DBb46DXFcmztNJGLVrFPit',
  keyPair: {
    privateKey: '4f78da356da498a860e7b955a320a91696d87c8b1057169a33aab0ca49609d37',
    publicKey: '0071ee7b3d6ea1245c4d408302558818f3b5ae0cff95db7eaaa44d4af3ace51195'
  }
}

describe('WalletAccountSolana', () => {
  let wallet
  let VALID_TOKEN
  beforeAll(async () => {
    const tokenMint = await createTestToken(SEED_PHRASE)
    if (!tokenMint) {
      throw new Error('Failed to create test token')
    }
    console.log('Test token created:', tokenMint)
    VALID_TOKEN = tokenMint
  })

  beforeEach(async () => {
    wallet = await WalletAccountSolana.create(VALID_SEED, VALID_PATH, VALID_CONFIG)
  })

  describe('create', () => {
    test('should successfully initialize an account for the given seed phrase and path', async () => {
      const account = await WalletAccountSolana.create(SEED_PHRASE, VALID_PATH)

      expect(account.index).toBe(ACCOUNT.index)

      expect(account.path).toBe(ACCOUNT.path)

      expect(account.keyPair).toEqual({
        privateKey: new Uint8Array(Buffer.from(ACCOUNT.keyPair.privateKey, 'hex')),
        publicKey: new Uint8Array(Buffer.from(ACCOUNT.keyPair.publicKey, 'hex'))
      }
      )
    })

    test('should successfully initialize an account for the given seed and path', async () => {
      const account = await WalletAccountSolana.create(VALID_SEED, VALID_PATH)

      expect(account.index).toBe(ACCOUNT.index)

      expect(account.path).toBe(ACCOUNT.path)

      expect(account.keyPair).toEqual({
        privateKey: new Uint8Array(Buffer.from(ACCOUNT.keyPair.privateKey, 'hex')),
        publicKey: new Uint8Array(Buffer.from(ACCOUNT.keyPair.publicKey, 'hex'))
      })
    })

    test('should throw if the seed phrase is invalid', async () => {
      await expect(WalletAccountSolana.create(INVALID_SEED_PHRASE, VALID_PATH)).rejects
        .toThrow('The seed phrase is invalid.')
    })

    test('should throw if the path is invalid', async () => {
      await expect(WalletAccountSolana.create(SEED_PHRASE, "a'/b")).rejects
        .toThrow('Invalid child index: a')
    })
  })

  describe('getAddress', () => {
    test('should return the correct address', async () => {
      const address = await wallet.getAddress()
      expect(address).toBe(ACCOUNT.address)
    })

    test('should throw error when getting address of uninitialized wallet', async () => {
      const walletWithoutAccount = new WalletAccountSolana(VALID_SEED, 'm/44\'/501\'/0\'/1\'')
      await expect(walletWithoutAccount.getAddress()).rejects.toThrow('The wallet must be initialized to get the address.')
    })
  })

  describe('sign', () => {
    const MESSAGE = 'Dummy message to sign.'

    const EXPECTED_SIGNATURE = '2sQocJ3Qgock5YDfqoPkZdweatfEDkVgcANYQT6kRomEsAgzPYmFh1oEHisFJNKRiQ6QNX2QJsoVEnUnt4vBpqT5'

    test('should return the correct signature', async () => {
      const signature = await wallet.sign(MESSAGE)

      expect(signature).toBe(EXPECTED_SIGNATURE)
    })

    test('should throw error when signing account is not initialized', async () => {
      const walletWithoutAccount = new WalletAccountSolana(VALID_SEED, 'm/44\'/501\'/0\'/1\'')
      await expect(walletWithoutAccount.sign('Hello, Solana!')).rejects.toThrow('The wallet must be initialized to sign messages.')
    })
  })

  describe('verify', () => {
    const MESSAGE = 'Dummy message to sign.'

    const SIGNATURE = '2sQocJ3Qgock5YDfqoPkZdweatfEDkVgcANYQT6kRomEsAgzPYmFh1oEHisFJNKRiQ6QNX2QJsoVEnUnt4vBpqT5'

    test('should return true for a valid signature', async () => {
      const result = await wallet.verify(MESSAGE, SIGNATURE)

      expect(result).toBe(true)
    })

    test('should return false for an invalid signature', async () => {
      const result = await wallet.verify('Another message.', SIGNATURE)
      expect(result).toBe(false)
    })

    test('should throw on a malformed signature', async () => {
      await expect(wallet.verify(MESSAGE, 'A bad signature'))
        .rejects.toThrow('Non-base58 character')
    })

    test('should throw error when verifying message with uninitialized wallet', async () => {
      const walletWithoutAccount = new WalletAccountSolana(VALID_SEED, 'm/44\'/501\'/0\'/1\'')
      await expect(walletWithoutAccount.verify('Hello, Solana!', '')).rejects.toThrow('The wallet must be initialized to verify messages.')
    })
  })

  describe('sendTransaction', () => {
    const TRANSACTION = { to: TO_ADDRESS, value: 1000000 }

    test('should successfully send a transaction', async () => {
      const txResult = await wallet.sendTransaction(TRANSACTION)
      expect(txResult).toBeDefined()
      expect(typeof txResult.hash).toBe('string')
      expect(typeof txResult.fee).toBe('number')
    })

    test('should throw error when sending transaction with invalid rpc', async () => {
      const walletWithoutRpc = new WalletAccountSolana(VALID_SEED, VALID_PATH)
      await expect(walletWithoutRpc.sendTransaction(TRANSACTION)).rejects.toThrow('The wallet must be connected to a provider to send transactions.')
    })
  })

  describe('quoteTransaction', () => {
    const TRANSACTION = { to: TO_ADDRESS, value: 1000000 }
    const EXPECTED_FEE = 5000
    test('should successfully quote a transaction', async () => {
      const quote = await wallet.quoteSendTransaction(TRANSACTION)
      expect(typeof quote).toBe('object')
      expect(quote.fee).toBeDefined()
      expect(typeof quote.fee).toBe('number')
      expect(quote.fee).toEqual(EXPECTED_FEE)
    })

    test('should throw error when quoting transaction with invalid address', async () => {
      const tx = { to: 'invalid', value: 1000000 }
      await expect(wallet.quoteSendTransaction(tx)).rejects.toThrow()
    })

    test('should throw error when quoting transaction with invalid rpc', async () => {
      const walletWithoutRpc = new WalletAccountSolana(VALID_SEED, VALID_PATH)
      await expect(walletWithoutRpc.quoteSendTransaction(TRANSACTION)).rejects.toThrow('The wallet must be connected to a provider to quote transactions.')
    })
  })

  describe('getBalance', () => {
    test('should get wallet balance', async () => {
      await sendCoinToIndexAccount(SEED_PHRASE, 1)

      const account = await WalletAccountSolana.create(VALID_SEED, INDEX_1_ACCOUNT_PATH, VALID_CONFIG)

      const balance = await account.getBalance()
      expect(balance).toBeGreaterThan(1000000000)
    })

    test('should throw error when getting balance without RPC', async () => {
      const walletWithoutRpc = new WalletAccountSolana(VALID_SEED, VALID_PATH)
      await expect(walletWithoutRpc.getBalance()).rejects.toThrow('The wallet must be connected to a provider to retrieve balances.')
    })
  })

  describe('getTokenBalance', () => {
    test('should return the correct token balance of the account', async () => {
      const balance = await wallet.getTokenBalance(VALID_TOKEN)
      expect(typeof balance).toBe('number')
      expect(balance).toBe(10000)
    })

    test('should throw error when getting token balance without RPC', async () => {
      const walletWithoutRpc = new WalletAccountSolana(VALID_SEED, VALID_PATH)
      await expect(walletWithoutRpc.getTokenBalance(VALID_TOKEN)).rejects.toThrow('rpcUrl is required to retrieve token balances.')
    })

    test('should throw error for invalid token address', async () => {
      await expect(wallet.getTokenBalance('invalid-token')).rejects.toThrow('Non-base58 character')
    })
  })

  describe('quoteTransfer', () => {
    test('should return fee for token transfer', async () => {
      const TOKEN_TRANSACTION = { recipient: TO_ADDRESS, token: VALID_TOKEN, amount: 10 }

      expect(VALID_TOKEN).toBeDefined()
      expect(typeof VALID_TOKEN).toBe('string')
      expect(VALID_TOKEN.length).toBe(44) // Base58 encoded token address length

      const quote = await wallet.quoteTransfer(TOKEN_TRANSACTION)
      expect(quote.fee).toBe(5000)
    })
  })

  describe('transfer', () => {
    test('should send token transaction', async () => {
      const TOKEN_TRANSACTION = { recipient: TO_ADDRESS, token: VALID_TOKEN, amount: 100 }

      const txResult = await wallet.transfer(TOKEN_TRANSACTION)
      expect(txResult).toBeDefined()
      expect(typeof txResult.hash).toBe('string')
      expect(typeof txResult.fee).toBe('number')
      await confirmTestTransaction(txResult.hash)
      const balance = await wallet.getTokenBalance(VALID_TOKEN)

      expect(balance).toBe(9900)
    })

    test('should throw program id error when sending invalid token transaction', async () => {
      const params = { recipient: VALID_ADDRESS, token: '9gT8yrFzG7e23NE4hRGMoPPBuaNjVKnp8pdH7HkjJnY3', amount: 1000000 }
      await expect(wallet.transfer(params)).rejects.toThrow('Failed to find account')
    })

    test('should handle token transaction errors', async () => {
      const params = { recipient: 'invalid', token: VALID_TOKEN, amount: 1000000 }
      await expect(wallet.transfer(params)).rejects.toThrow()
    })
  })

  describe('dispose', () => {
    test('should dispose the wallet account', () => {
      wallet.dispose()
      expect(wallet.path).toBeNull()
      expect(wallet.keyPair.privateKey).toBeNull()
    })
  })
})
