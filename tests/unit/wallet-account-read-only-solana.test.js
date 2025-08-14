'use strict'
import { describe, expect, jest } from '@jest/globals'

jest.unstable_mockModule('@solana/web3.js', async () => {
  const actual = await jest.requireActual('@solana/web3.js')

  return {
    ...actual,
    PublicKey: jest.fn((key) => `MockPublicKey(${key})`),

    Transaction: jest.fn(() => {
      const tx = {
        add: jest.fn(function () { return tx }),
        sign: jest.fn(),
        compileMessage: jest.fn(),
        serialize: jest.fn()
      }
      return tx
    })
  }
})

jest.unstable_mockModule('@solana/spl-token', async () => {
  const mockTokenInstance = {
    getOrCreateAssociatedAccountInfo: jest.fn(async (pubKey) => ({ address: `acct-${pubKey}` }))
  }

  const MockTokenClass = jest.fn(() => mockTokenInstance)

  MockTokenClass.createTransferInstruction = jest.fn(() => 'mock-instruction')

  return {
    Token: MockTokenClass,
    TOKEN_PROGRAM_ID: 'mock-token-program-id'
  }
})

const { default: WalletAccountReadOnlySolana } = await import('../../src/wallet-account-read-only-solana.js')

const ADDRESS = '7YKHgGWWGgFZMS87Unxyzog4nGWhAwGzfr7SxbPcuskv'
const VALID_TOKEN = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'
const VALID_CONFIG = { rpcUrl: 'http://localhost:8899' }

describe('WalletManagerSolana', () => {
  let account

  beforeEach(async () => {
    account = new WalletAccountReadOnlySolana(ADDRESS, VALID_CONFIG)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('getBalance', () => {
    test('should get wallet balance', async () => {
      account._rpc = {

        getBalance: jest.fn(() => ({
          send: jest.fn().mockResolvedValue({ value: 10000 })
        }))

      }
      const balance = await account.getBalance()
      expect(balance).toBe(10000)
    })

    test('should throw error when getting balance without RPC', async () => {
      const accountWithoutRpc = new WalletAccountReadOnlySolana(ADDRESS)
      await expect(accountWithoutRpc.getBalance()).rejects.toThrow('The wallet must be connected to a provider to retrieve balances.')
    })
  })

  describe('getTokenBalance', () => {
    test('should return the correct token balance of the account', async () => {
      account._connection = {

        getTokenAccountsByOwner: jest.fn().mockResolvedValue({ value: [{ pubKey: 'pubkey' }] }),
        getTokenAccountBalance: jest.fn().mockResolvedValue({ value: { amount: 200 } })

      }
      const balance = await account.getTokenBalance(VALID_TOKEN)
      expect(balance).toBe(200)
    })

    test('should return zero if account not found', async () => {
      const tokenAccount = new WalletAccountReadOnlySolana(ADDRESS, VALID_CONFIG)
      tokenAccount._connection = {

        getTokenAccountsByOwner: jest.fn().mockResolvedValue({ value: [] })

      }
      const balance = await tokenAccount.getTokenBalance(VALID_TOKEN)
      expect(balance).toBe(0)
    })

    test('should throw error when getting token balance without RPC', async () => {
      const walletWithoutRpc = new WalletAccountReadOnlySolana(ADDRESS)
      await expect(walletWithoutRpc.getTokenBalance(VALID_TOKEN)).rejects.toThrow('The wallet must be connected to a provider to retrieve token balances.')
    })
  })

  describe('getTransactionReceipt', () => {
    const hash = '42Q1aCpZz1azbVdH9KjLQZf8bSyciDV1R1AXw5GTNnCT8dLpa2JxkB5CT5xoADfstM4P3jQEXtMBSUav2YxoYaYE'

    test('should return valid transaction receipt', async () => {
      account._rpc = {
        getTransaction: jest.fn(() => ({
          send: jest.fn().mockResolvedValue({
            transaction: {
              signatures: [hash],
              message: {
                instructions: [{
                  type: 'transfer',
                  info: {
                    destination: 'Ha3dxG55uy27e2WNKsrQa8JiPMDt2DGkTxoKa6XkR9WN',
                    lamports: 1000,
                    source: '62u3ZcUSriL8ce4xifs81eUPXHhRiB4KnePT1KmCfV1x'
                  }
                }]
              }
            }
          })
        }))
      }
      const tx = await account.getTransactionReceipt(hash)

      expect(tx.transaction.signatures[0]).toEqual(hash)
      expect(tx.transaction.message.instructions.length).toEqual(1)
    })

    test('should throw if rpc not available ', async () => {
      account._rpc = null
      await expect(account.getTransactionReceipt(hash))
        .rejects.toThrow('The wallet must be connected to a provider to fetch transaction receipts.')
    })
  })

  describe('quoteSendTransaction', () => {
    const TRANSACTION = { to: '62u3ZcUSriL8ce4xifs81eUPXHhRiB4KnePT1KmCfV1x', value: 10 }
    test('should return valid transaction fee', async () => {
      account._rpc = {
        getLatestBlockhash: jest.fn(() => ({
          send: jest.fn().mockResolvedValue({ value: { blockhash: 'qAimPSfi1gAmJ9rPjeursQaeZE1bKDBdjkeiwdkXFjz', lastValidBlockHeight: 359503820 } })
        })),
        getFeeForMessage: jest.fn(() => ({
          send: jest.fn().mockResolvedValue({ value: 5000 })
        }))
      }
      const transaction = await account.quoteSendTransaction(TRANSACTION)
      expect(transaction.fee).toBe(5000)
    })

    test('should throw error when quoting transaction with invalid rpc', async () => {
      const withoutRpc = new WalletAccountReadOnlySolana(ADDRESS)
      await expect(withoutRpc.quoteSendTransaction(TRANSACTION)).rejects.toThrow('The wallet must be connected to a provider to quote transactions.')
    })
  })

  describe('quoteTransfer', () => {
    const TOKEN_TRANSACTION = { token: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', recipient: '62u3ZcUSriL8ce4xifs81eUPXHhRiB4KnePT1KmCfV1x', amount: 10 }
    test('should return valid transfer fee', async () => {
      account._connection = {
        getLatestBlockhash: jest.fn(() => ({
          send: jest.fn().mockResolvedValue({ value: { blockhash: 'qAimPSfi1gAmJ9rPjeursQaeZE1bKDBdjkeiwdkXFjz', lastValidBlockHeight: 359503820 } })
        })),
        getFeeForMessage: jest.fn().mockResolvedValue({ value: 5000 })
      }
      const transaction = await account.quoteTransfer(TOKEN_TRANSACTION)
      expect(transaction.fee).toBe(5000)
    })

    test('should throw error checking fee without valid RPC url', async () => {
      const accountWithoutRpc = new WalletAccountReadOnlySolana(ADDRESS)
      await expect(accountWithoutRpc.quoteTransfer(TOKEN_TRANSACTION)).rejects.toThrow('The wallet must be connected to a provider to quote transfer operations.')
    })
  })
})
