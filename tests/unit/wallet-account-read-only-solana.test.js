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

const address = '7YKHgGWWGgFZMS87Unxyzog4nGWhAwGzfr7SxbPcuskv'

const testConfig = { rpcUrl: 'http://localhost:8899', wsUrl: 'ws://localhost:8900' }

describe('WalletManagerSolana', () => {
  let account

  beforeEach(async () => {
    account = new WalletAccountReadOnlySolana(address, testConfig)
  })

  afterEach(() => {
    jest.restoreAllMocks()
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

  describe('_getTransaction', () => {
    test('should return valid unsigned transaction', async () => {
      account._rpc = {
        getLatestBlockhash: jest.fn(() => ({
          send: jest.fn().mockResolvedValue({ value: { blockhash: 'qAimPSfi1gAmJ9rPjeursQaeZE1bKDBdjkeiwdkXFjz', lastValidBlockHeight: 359503820 } })
        }))
      }
      const transaction = await account._getTransaction({ to: '62u3ZcUSriL8ce4xifs81eUPXHhRiB4KnePT1KmCfV1x', value: 10 })
      expect(transaction).toBeDefined()
      expect(transaction.feePayer.address).toBe(address)
      expect(transaction.instructions.length).toBe(1)
      expect(transaction.lifetimeConstraint.blockhash).toBe('qAimPSfi1gAmJ9rPjeursQaeZE1bKDBdjkeiwdkXFjz')
    })
  })

  describe('_getTransfer', () => {
    test('should return valid unsigned transfer', async () => {
      account._connection = {
        getLatestBlockhash: jest.fn(() => ({
          send: jest.fn().mockResolvedValue({ value: { blockhash: 'qAimPSfi1gAmJ9rPjeursQaeZE1bKDBdjkeiwdkXFjz', lastValidBlockHeight: 359503820 } })
        }))
      }
      const transaction = await account._getTransfer({ token: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', recipient: '62u3ZcUSriL8ce4xifs81eUPXHhRiB4KnePT1KmCfV1x', amount: 10 })
      expect(transaction).toBeDefined()
      expect(typeof transaction.serialize).toBe('function')
      expect(typeof transaction.compileMessage).toBe('function')
      expect(typeof transaction.sign).toBe('function')
    })
  })
})
