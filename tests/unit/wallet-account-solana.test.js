'use strict'

import { describe, jest } from '@jest/globals'
import * as bip39 from 'bip39'
import WalletAccountReadOnlySolana from '../../src/wallet-account-read-only-solana.js'

jest.unstable_mockModule('@solana/kit', async () => {
  const actual = await jest.requireActual('@solana/kit')
  return {
    ...actual,
    sendAndConfirmTransactionFactory: jest.fn(() => jest.fn())
  }
})

// Mock web3.js
jest.unstable_mockModule('@solana/web3.js', async () => {
  const actual = await jest.requireActual('@solana/web3.js')

  return {
    ...actual,
    PublicKey: jest.fn((key) => `MockPublicKey(${key})`),

    Transaction: jest.fn(() => {
      const tx = {
        add: jest.fn(function () { return tx }), // return same object for chaining
        sign: jest.fn(),
        compileMessage: jest.fn(),
        serialize: jest.fn()
      }
      return tx
    })
  }
})

// Mock SPL Token
jest.unstable_mockModule('@solana/spl-token', async () => {
  // Create a mock Token class
  const mockTokenInstance = {
    getOrCreateAssociatedAccountInfo: jest.fn(async (pubKey) => ({ address: `acct-${pubKey}` }))
  }

  const MockTokenClass = jest.fn(() => mockTokenInstance)

  // Add the static method directly to the mock class
  MockTokenClass.createTransferInstruction = jest.fn(() => 'mock-instruction')

  return {
    Token: MockTokenClass,
    TOKEN_PROGRAM_ID: 'mock-token-program-id'
  }
})

const SEED_PHRASE = 'cook voyage document eight skate token alien guide drink uncle term abuse'

const VALID_SEED = bip39.mnemonicToSeedSync(SEED_PHRASE)
const VALID_PATH = "0'/0/0" // BIP-44 path for Solana accounts
const VALID_CONFIG = { rpcUrl: 'http://localhost:8899', wsUrl: 'ws://localhost:8900' } // Use solana-test-validator RPC
const TO_ADDRESS = '6m69wRwfLiKxgfvfcTuHs7dxfL4jCjBWdc9dQWUTcn19'
const INVALID_SEED_PHRASE = 'invalid seed phrase'
const INDEX_1_ACCOUNT_PATH = "0'/0/1"
const VALID_TOKEN = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'

const ACCOUNT = {
  index: 0,
  path: "m/44'/501'/0'/0/0",
  address: '7YKHgGWWGgFZMS87Unxyzog4nGWhAwGzfr7SxbPcuskv',
  keyPair: {
    privateKey: '03d2ef9708f8e5d23ee50dd93b435da3cb1d3470b9a85a41e3697e3806a1a75d612bcdee8a0a93d631d901484b2e40373ddbd783e17f58ad9e486bd5f77d3f0b',
    publicKey: '612bcdee8a0a93d631d901484b2e40373ddbd783e17f58ad9e486bd5f77d3f0b'
  }
}
const { default: WalletAccountSolana } = await import('../../src/wallet-account-solana.js')

describe('WalletAccountSolana', () => {
  let account
  beforeEach(async () => {
    account = await WalletAccountSolana.at(VALID_SEED, VALID_PATH, VALID_CONFIG)
    account._rpc = {
      getLatestBlockhash: jest.fn(() => ({
        send: jest.fn().mockResolvedValue({ value: { blockhash: 'qAimPSfi1gAmJ9rPjeursQaeZE1bKDBdjkeiwdkXFjz', lastValidBlockHeight: 359503820 } })
      })),

      getFeeForMessage: jest.fn(() => ({
        send: jest.fn().mockResolvedValue({ value: 5000 })
      }))

    }

    account._connection = {

      getLatestBlockhash: jest.fn().mockResolvedValue({ blockhash: 'qAimPSfi1gAmJ9rPjeursQaeZE1bKDBdjkeiwdkXFjz' }),
      getTokenAccountsByOwner: jest.fn(),
      getFeeForMessage: jest.fn().mockResolvedValue({ value: 5000 }),
      sendRawTransaction: jest.fn().mockResolvedValue('AHxKz6BYmxAeESq8TzsGphHAUgAUNH2Uh239F5sEsdvNyqWBPYUdSHbccAWQKebWFajJ2xS4WQrBdAiEnbNdUnY')
    }
  })

  afterEach(() => {
    jest.restoreAllMocks()
    account?.dispose()
  })

  describe('at', () => {
    test('should successfully initialize an account for the given seed phrase and path', async () => {
      const account = await WalletAccountSolana.at(SEED_PHRASE, VALID_PATH)

      expect(account.index).toBe(ACCOUNT.index)

      expect(account.path).toBe(ACCOUNT.path)

      expect(account.keyPair).toEqual({
        privateKey: new Uint8Array(Buffer.from(ACCOUNT.keyPair.privateKey, 'hex')),
        publicKey: new Uint8Array(Buffer.from(ACCOUNT.keyPair.publicKey, 'hex'))
      }
      )
    })

    test('should successfully initialize an account for the given seed and path', async () => {
      const account = await WalletAccountSolana.at(VALID_SEED, VALID_PATH)

      expect(account.index).toBe(ACCOUNT.index)

      expect(account.path).toBe(ACCOUNT.path)

      expect(account.keyPair).toEqual({
        privateKey: new Uint8Array(Buffer.from(ACCOUNT.keyPair.privateKey, 'hex')),
        publicKey: new Uint8Array(Buffer.from(ACCOUNT.keyPair.publicKey, 'hex'))
      })
    })

    test('should throw if the seed phrase is invalid', async () => {
      await expect(WalletAccountSolana.at(INVALID_SEED_PHRASE, VALID_PATH)).rejects
        .toThrow('The seed phrase is invalid.')
    })

    test('should throw if the path is invalid', async () => {
      await expect(WalletAccountSolana.at(SEED_PHRASE, "a'/b")).rejects
        .toThrow('Invalid child index: a')
    })
  })

  describe('getAddress', () => {
    test('should return the correct address', async () => {
      const address = await account.getAddress()
      expect(address).toBe(ACCOUNT.address)
    })
  })

  describe('sign', () => {
    const MESSAGE = 'Dummy message to sign.'

    const EXPECTED_SIGNATURE = 'ce5c456edf29423e85a7a7f06150cb5bfd282c8771d7b7107f8eab94ecae1960e6cbf0487f63102590c90e076e3f6e74e8745213da152577b1278a12dd0df800'

    test('should return the correct signature', async () => {
      const signature = await account.sign(MESSAGE)

      expect(signature).toBe(EXPECTED_SIGNATURE)
    })
  })

  describe('verify', () => {
    const MESSAGE = 'Dummy message to sign.'

    const SIGNATURE = 'ce5c456edf29423e85a7a7f06150cb5bfd282c8771d7b7107f8eab94ecae1960e6cbf0487f63102590c90e076e3f6e74e8745213da152577b1278a12dd0df800'

    test('should return true for a valid signature', async () => {
      const result = await account.verify(MESSAGE, SIGNATURE)

      expect(result).toBe(true)
    })

    test('should return false for an invalid signature', async () => {
      const result = await account.verify('Another message.', SIGNATURE)
      expect(result).toBe(false)
    })
  })

  describe('sendTransaction', () => {
    const TRANSACTION = { to: TO_ADDRESS, value: 1000000 }

    test('should successfully send a transaction', async () => {
      const expectedHash = '2m5CT3HnLjf3Jr5fKLsQtm25cXu9xRYuPiRKziXfSCXU39JTj9xo2YWCjHrw2YwZgPamU8inYpFR11LD6Hs3trhz'

      const txResult = await account.sendTransaction(TRANSACTION)

      expect(expectedHash).toEqual(txResult.hash)
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
      const quote = await account.quoteSendTransaction(TRANSACTION)
      expect(quote.fee).toEqual(EXPECTED_FEE)
    })

    test('should throw error when quoting transaction with invalid address', async () => {
      const tx = { to: 'invalid', value: 1000000 }
      await expect(account.quoteSendTransaction(tx)).rejects.toThrow()
    })

    test('should throw error when quoting transaction with invalid rpc', async () => {
      const walletWithoutRpc = new WalletAccountSolana(VALID_SEED, VALID_PATH)
      await expect(walletWithoutRpc.quoteSendTransaction(TRANSACTION)).rejects.toThrow('The wallet must be connected to a provider to quote transactions.')
    })
  })

  describe('getBalance', () => {
    test('should get wallet balance', async () => {
      const account = await WalletAccountSolana.at(VALID_SEED, INDEX_1_ACCOUNT_PATH, VALID_CONFIG)
      account._rpc = {

        getBalance: jest.fn(() => ({
          send: jest.fn().mockResolvedValue({ value: 10000 })
        }))

      }
      const balance = await account.getBalance()
      expect(balance).toBeGreaterThanOrEqual(10000)
    })

    test('should throw error when getting balance without RPC', async () => {
      const walletWithoutRpc = new WalletAccountSolana(VALID_SEED, VALID_PATH)
      await expect(walletWithoutRpc.getBalance()).rejects.toThrow('The wallet must be connected to a provider to retrieve balances.')
    })
  })

  describe('getTokenBalance', () => {
    test('should return the correct token balance of the account', async () => {
      const tokenAccount = await WalletAccountSolana.at(VALID_SEED, INDEX_1_ACCOUNT_PATH, VALID_CONFIG)
      tokenAccount._connection = {

        getTokenAccountsByOwner: jest.fn().mockResolvedValue({ value: [{ pubKey: ACCOUNT.keyPair.publicKey }] }),
        getTokenAccountBalance: jest.fn().mockResolvedValue({ value: { amount: 200 } })

      }
      const balance = await tokenAccount.getTokenBalance(VALID_TOKEN)
      expect(balance).toBe(200)
    })

    test('should return zero if account not found', async () => {
      const tokenAccount = await WalletAccountSolana.at(VALID_SEED, INDEX_1_ACCOUNT_PATH, VALID_CONFIG)
      tokenAccount._connection = {

        getTokenAccountsByOwner: jest.fn().mockResolvedValue({ value: [] })

      }
      const balance = await tokenAccount.getTokenBalance(VALID_TOKEN)
      expect(balance).toBe(0)
    })

    test('should throw error when getting token balance without RPC', async () => {
      const walletWithoutRpc = new WalletAccountSolana(VALID_SEED, VALID_PATH)
      await expect(walletWithoutRpc.getTokenBalance(VALID_TOKEN)).rejects.toThrow('The wallet must be connected to a provider to retrieve token balances.')
    })

    test('should throw error for invalid token address', async () => {
      account._connection = {
        getTokenAccountsByOwner: jest.fn(() => { throw new Error('Non-base58 character') })
      }
      await expect(account.getTokenBalance('invalid-token')).rejects.toThrow('Non-base58 character')
    })
  })

  describe('quoteTransfer', () => {
    test('should return fee for token transfer', async () => {
      const TOKEN_TRANSACTION = { recipient: TO_ADDRESS, token: VALID_TOKEN, amount: 10 }

      const quote = await account.quoteTransfer(TOKEN_TRANSACTION)
      expect(quote.fee).toBe(5000)
    })

    test('should throw error checking fee without valid RPC url', async () => {
      const TOKEN_TRANSACTION = { recipient: TO_ADDRESS, token: VALID_TOKEN, amount: 10 }
      const walletWithoutRpc = new WalletAccountSolana(VALID_SEED, VALID_PATH)
      await expect(walletWithoutRpc.quoteTransfer(TOKEN_TRANSACTION)).rejects.toThrow('The wallet must be connected to a provider to quote transfer operations.')
    })
  })

  describe('transfer', () => {
    test('should send token transaction', async () => {
      const TOKEN_TRANSACTION = { recipient: TO_ADDRESS, token: VALID_TOKEN, amount: 100 }

      const txResult = await account.transfer(TOKEN_TRANSACTION)
      expect(txResult).toBeDefined()
    })

    test('should throw RPC error on token transfer', async () => {
      const TOKEN_TRANSACTION = { recipient: TO_ADDRESS, token: VALID_TOKEN, amount: 100 }
      const walletWithoutRpc = new WalletAccountSolana(VALID_SEED, VALID_PATH)
      await expect(walletWithoutRpc.transfer(TOKEN_TRANSACTION)).rejects.toThrow('The wallet must be connected to a provider to transfer tokens.')
    })

    test('should throw  error when fee is more than transferMaxFee ', async () => {
      const TOKEN_TRANSACTION = { recipient: TO_ADDRESS, token: VALID_TOKEN, amount: 100 }
      const wallet = await WalletAccountSolana.at(VALID_SEED, VALID_PATH, { ...VALID_CONFIG, transferMaxFee: 0 })
      wallet._rpc = account._rpc
      wallet._connection = account._connection
      await expect(wallet.transfer(TOKEN_TRANSACTION)).rejects.toThrow('Exceeded maximum fee cost for transfer operation.')
    })
  })

  describe('toReadOnlyAccount', () => {
    test('should return readOnly account instance', async () => {
      const readOnlyAccount = await account.toReadOnlyAccount()
      expect(readOnlyAccount).toBeInstanceOf(WalletAccountReadOnlySolana)
    })
  })
})
