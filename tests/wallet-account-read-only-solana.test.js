// Copyright 2024 Tether Operations Limited
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use strict'

import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import WalletAccountReadOnlySolana from '../src/wallet-account-read-only-solana.js'
import WalletAccountSolana from '../src/wallet-account-solana.js'

const TEST_ADDRESS = 'HmWPZeFgxZAJQYgwh5ipYwjbVTHtjEHB3dnJ5xcQBHX9'
const TEST_ACCOUNT_ADDRESS = '3uXqWpwgqKVdiHAwF6Vmu4G4vdQzpR66xjPkz1G7zMKE'
const TEST_SEED_PHRASE =
  'test walk nut penalty hip pave soap entry language right filter choice'
const TEST_RPC_URL = 'https://mockurl.com'

describe('WalletAccountReadOnlySolana', () => {
  let readOnlyAccount
  let mockRpc

  beforeEach(() => {
    readOnlyAccount = new WalletAccountReadOnlySolana(TEST_ADDRESS, {})

    mockRpc = {
      getBalance: jest.fn(),
      getAccountInfo: jest.fn(),
      getTokenAccountBalance: jest.fn(),
      getLatestBlockhash: jest.fn(),
      getFeeForMessage: jest.fn(),
      getTransaction: jest.fn()
    }

    readOnlyAccount._rpc = mockRpc
    readOnlyAccount._commitment = 'confirmed'
  })

  describe('Constructor', () => {
    it('should create instance with valid config', () => {
      const account = new WalletAccountReadOnlySolana(TEST_ADDRESS, {
        rpcUrl: TEST_RPC_URL,
        commitment: 'confirmed'
      })

      expect(account).toBeInstanceOf(WalletAccountReadOnlySolana)
      expect(account._rpc).toBeDefined()
      expect(account._commitment).toBe('confirmed')
    })

    it('should create instance without rpcUrl', () => {
      const account = new WalletAccountReadOnlySolana(TEST_ADDRESS, {})
      expect(account._rpc).toBeUndefined()
    })

    it('should use default commitment level', () => {
      const account = new WalletAccountReadOnlySolana(TEST_ADDRESS, {
        rpcUrl: TEST_RPC_URL
      })
      expect(account._commitment).toBe('confirmed')
    })
  })

  describe('getBalance', () => {
    it('should return SOL balance in lamports', async () => {
      mockRpc.getBalance.mockReturnValue({
        send: jest.fn().mockResolvedValue({ value: 1000000000n })
      })

      const balance = await readOnlyAccount.getBalance()

      expect(balance).toBe(1000000000n)
      expect(mockRpc.getBalance).toHaveBeenCalledTimes(1)
    })

    it('should return zero balance for empty account', async () => {
      mockRpc.getBalance.mockReturnValue({
        send: jest.fn().mockResolvedValue({ value: 0n })
      })

      const balance = await readOnlyAccount.getBalance()

      expect(balance).toBe(0n)
    })

    it('should throw error when not connected to provider', async () => {
      const disconnectedAccount = new WalletAccountReadOnlySolana(
        TEST_ADDRESS,
        {}
      )

      await expect(disconnectedAccount.getBalance()).rejects.toThrow(
        'The wallet must be connected to a provider to retrieve balances.'
      )
    })

    it('should handle RPC errors gracefully', async () => {
      mockRpc.getBalance.mockReturnValue({
        send: jest.fn().mockRejectedValue(new Error('RPC error'))
      })

      await expect(readOnlyAccount.getBalance()).rejects.toThrow('RPC error')
    })

    it('should pass commitment level to RPC call', async () => {
      mockRpc.getBalance.mockReturnValue({
        send: jest.fn().mockResolvedValue({ value: 1000000000n })
      })

      await readOnlyAccount.getBalance()

      expect(mockRpc.getBalance).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ commitment: 'confirmed' })
      )
    })
  })

  describe('getTokenBalance', () => {
    const MOCK_TOKEN_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'

    it('should return token balance when ATA exists (TOKEN_PROGRAM)', async () => {
      mockRpc.getAccountInfo.mockReturnValueOnce({
        send: jest.fn().mockResolvedValue({
          value: {
            owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
            lamports: 2039280n,
            data: [Buffer.alloc(165).toString('base64'), 'base64']
          }
        })
      })

      mockRpc.getTokenAccountBalance.mockReturnValue({
        send: jest.fn().mockResolvedValue({
          value: {
            amount: '1000000',
            decimals: 6,
            uiAmount: 1.0,
            uiAmountString: '1.0'
          }
        })
      })

      const balance = await readOnlyAccount.getTokenBalance(MOCK_TOKEN_MINT)

      expect(balance).toBe(1000000n)
      expect(mockRpc.getAccountInfo).toHaveBeenCalledTimes(1)
      expect(mockRpc.getTokenAccountBalance).toHaveBeenCalledTimes(1)
    })

    it('should return zero when ATA does not exist', async () => {
      mockRpc.getAccountInfo
        .mockReturnValueOnce({
          send: jest.fn().mockResolvedValue({ value: null })
        })
        .mockReturnValueOnce({
          send: jest.fn().mockResolvedValue({ value: null })
        })

      const balance = await readOnlyAccount.getTokenBalance(MOCK_TOKEN_MINT)

      expect(balance).toBe(0n)
      expect(mockRpc.getAccountInfo).toHaveBeenCalledTimes(1)
      expect(mockRpc.getTokenAccountBalance).not.toHaveBeenCalled()
    })

    it('should return zero balance when ATA exists but has no tokens', async () => {
      mockRpc.getAccountInfo.mockReturnValue({
        send: jest.fn().mockResolvedValue({
          value: {
            owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
            lamports: 2039280n,
            data: [Buffer.alloc(165).toString('base64'), 'base64']
          }
        })
      })

      mockRpc.getTokenAccountBalance.mockReturnValue({
        send: jest.fn().mockResolvedValue({
          value: {
            amount: '0',
            decimals: 6,
            uiAmount: 0,
            uiAmountString: '0'
          }
        })
      })

      const balance = await readOnlyAccount.getTokenBalance(MOCK_TOKEN_MINT)

      expect(balance).toBe(0n)
    })

    it('should throw error when not connected to provider', async () => {
      const disconnectedAccount = new WalletAccountReadOnlySolana(
        TEST_ADDRESS,
        {}
      )

      await expect(
        disconnectedAccount.getTokenBalance(MOCK_TOKEN_MINT)
      ).rejects.toThrow(
        'The wallet must be connected to a provider to retrieve token balances.'
      )
    })

    it('should throw error for invalid token mint address', async () => {
      const invalidMint = 'invalid-mint-address'

      await expect(
        readOnlyAccount.getTokenBalance(invalidMint)
      ).rejects.toThrow()
    })

    it('should throw error when getAccountInfo fails', async () => {
      mockRpc.getAccountInfo.mockReturnValue({
        send: jest
          .fn()
          .mockRejectedValue(
            new Error('RPC error: Failed to fetch account info')
          )
      })

      await expect(
        readOnlyAccount.getTokenBalance(MOCK_TOKEN_MINT)
      ).rejects.toThrow('RPC error: Failed to fetch account info')
    })

    it('should throw error when getTokenAccountBalance fails', async () => {
      mockRpc.getAccountInfo.mockReturnValue({
        send: jest.fn().mockResolvedValue({
          value: {
            owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
            lamports: 2039280n,
            data: [Buffer.alloc(165).toString('base64'), 'base64']
          }
        })
      })

      mockRpc.getTokenAccountBalance.mockReturnValue({
        send: jest
          .fn()
          .mockRejectedValue(new Error('Failed to get token balance'))
      })

      await expect(
        readOnlyAccount.getTokenBalance(MOCK_TOKEN_MINT)
      ).rejects.toThrow('Failed to get token balance')
    })

    it('should handle different token mints', async () => {
      const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'
      const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

      mockRpc.getAccountInfo.mockReturnValue({
        send: jest.fn().mockResolvedValue({
          value: {
            owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
            lamports: 2039280n,
            data: [Buffer.alloc(165).toString('base64'), 'base64']
          }
        })
      })

      mockRpc.getTokenAccountBalance
        .mockReturnValueOnce({
          send: jest.fn().mockResolvedValue({
            value: {
              amount: '1000000',
              decimals: 6,
              uiAmount: 1.0,
              uiAmountString: '1.0'
            }
          })
        })
        .mockReturnValueOnce({
          send: jest.fn().mockResolvedValue({
            value: {
              amount: '5000000',
              decimals: 6,
              uiAmount: 5.0,
              uiAmountString: '5.0'
            }
          })
        })

      const usdtBalance = await readOnlyAccount.getTokenBalance(USDT_MINT)
      const usdcBalance = await readOnlyAccount.getTokenBalance(USDC_MINT)

      expect(usdtBalance).toBe(1000000n)
      expect(usdcBalance).toBe(5000000n)
    })
  })

  describe('quoteSendTransaction', () => {
    describe('TransferNativeTransaction', () => {
      beforeEach(() => {
        mockRpc.getLatestBlockhash.mockReturnValue({
          send: jest.fn().mockResolvedValue({
            value: {
              blockhash: 'HhqkdqemrKDK5Wd4oiCtzfpBWfdGS79YhLtzAck5Nz7T',
              lastValidBlockHeight: 100000n
            }
          })
        })

        mockRpc.getFeeForMessage.mockReturnValue({
          send: jest.fn().mockResolvedValue({ value: 5000n })
        })
      })

      it('should quote fee for native SOL transfer with bigint value', async () => {
        const nativeTx = {
          to: '4r33xEKAD2cNMrC9NyJy8nb4XmruUKebZ6LZZm65PVUZ',
          value: 1000000000n
        }

        const result = await readOnlyAccount.quoteSendTransaction(nativeTx)

        expect(result).toEqual({ fee: 5000n })
        expect(typeof result.fee).toBe('bigint')
        expect(mockRpc.getLatestBlockhash).toHaveBeenCalledTimes(1)
        expect(mockRpc.getFeeForMessage).toHaveBeenCalledTimes(1)
      })

      it('should quote fee for native SOL transfer with number value', async () => {
        const nativeTx = {
          to: '3gx5puA146Y1jb6dV4KS8vQnXtuXSZsAPV89JeaqfFXW',
          value: 1000000000
        }

        const result = await readOnlyAccount.quoteSendTransaction(nativeTx)

        expect(result).toEqual({ fee: 5000n })
      })

      it('should throw error for invalid recipient address', async () => {
        const invalidTx = { to: 'invalid-address', value: 1000 }

        await expect(
          readOnlyAccount.quoteSendTransaction(invalidTx)
        ).rejects.toThrow()
      })

      it('should throw error for negative value', async () => {
        const invalidTx = {
          to: '3gx5puA146Y1jb6dV4KS8vQnXtuXSZsAPV89JeaqfFXW',
          value: -1000
        }

        await expect(
          readOnlyAccount.quoteSendTransaction(invalidTx)
        ).rejects.toThrow()
      })

      it('should handle getLatestBlockhash failure', async () => {
        mockRpc.getLatestBlockhash.mockReturnValue({
          send: jest.fn().mockRejectedValue(new Error('Network error'))
        })

        const nativeTx = {
          to: '3gx5puA146Y1jb6dV4KS8vQnXtuXSZsAPV89JeaqfFXW',
          value: 1000000n
        }

        await expect(
          readOnlyAccount.quoteSendTransaction(nativeTx)
        ).rejects.toThrow('Network error')
      })

      it('should handle getFeeForMessage failure', async () => {
        mockRpc.getFeeForMessage.mockReturnValue({
          send: jest
            .fn()
            .mockRejectedValue(new Error('Failed to calculate fee'))
        })

        const nativeTx = {
          to: '3gx5puA146Y1jb6dV4KS8vQnXtuXSZsAPV89JeaqfFXW',
          value: 1000000n
        }

        await expect(
          readOnlyAccount.quoteSendTransaction(nativeTx)
        ).rejects.toThrow('Failed to calculate fee')
      })

      it('should handle null fee response', async () => {
        mockRpc.getFeeForMessage.mockReturnValue({
          send: jest.fn().mockResolvedValue({ value: null })
        })

        const nativeTx = {
          to: '3gx5puA146Y1jb6dV4KS8vQnXtuXSZsAPV89JeaqfFXW',
          value: 1000000n
        }

        await expect(
          readOnlyAccount.quoteSendTransaction(nativeTx)
        ).rejects.toThrow('Failed to calculate transaction fee')
      })
    })

    describe('TransactionMessage', () => {
      beforeEach(() => {
        mockRpc.getLatestBlockhash.mockReturnValue({
          send: jest.fn().mockResolvedValue({
            value: {
              blockhash: 'HhqkdqemrKDK5Wd4oiCtzfpBWfdGS79YhLtzAck5Nz7T',
              lastValidBlockHeight: 100000n
            }
          })
        })

        mockRpc.getFeeForMessage.mockReturnValue({
          send: jest.fn().mockResolvedValue({ value: 5000n })
        })
      })

      it('should quote fee for TransactionMessage with instructions', async () => {
        const transactionMessage = {
          version: 0,
          instructions: [
            {
              programAddress: '11111111111111111111111111111111',
              accounts: [],
              data: new Uint8Array([])
            }
          ],
          lifetimeConstraint: {
            blockhash: 'HhqkdqemrKDK5Wd4oiCtzfpBWfdGS79YhLtzAck5Nz7T',
            lastValidBlockHeight: 100000n
          }
        }

        const result =
          await readOnlyAccount.quoteSendTransaction(transactionMessage)

        expect(result).toEqual({ fee: 5000n })
        expect(mockRpc.getFeeForMessage).toHaveBeenCalledTimes(1)
      })

      it('should add lifetimeConstraint when missing from TransactionMessage', async () => {
        const transactionMessage = {
          version: 0,
          instructions: [
            {
              programAddress: '11111111111111111111111111111111',
              accounts: [],
              data: new Uint8Array([])
            }
          ]
        }

        const result =
          await readOnlyAccount.quoteSendTransaction(transactionMessage)

        expect(result).toEqual({ fee: 5000n })
        expect(mockRpc.getLatestBlockhash).toHaveBeenCalledTimes(1)
        expect(mockRpc.getLatestBlockhash).toHaveBeenCalledWith(
          expect.objectContaining({ commitment: 'confirmed' })
        )
        expect(mockRpc.getFeeForMessage).toHaveBeenCalledTimes(1)
      })

      it('should verify feePayer matches wallet address', async () => {
        const transactionMessage = {
          version: 0,
          instructions: [
            {
              programAddress: '11111111111111111111111111111111',
              accounts: [],
              data: new Uint8Array([])
            }
          ],
          feePayer: TEST_ADDRESS,
          lifetimeConstraint: {
            blockhash: 'HhqkdqemrKDK5Wd4oiCtzfpBWfdGS79YhLtzAck5Nz7T',
            lastValidBlockHeight: 100000n
          }
        }

        const result =
          await readOnlyAccount.quoteSendTransaction(transactionMessage)

        expect(result).toEqual({ fee: 5000n })
      })

      it('should throw error when feePayer does not match wallet address', async () => {
        const differentAddress = '4r33xEKAD2cNMrC9NyJy8nb4XmruUKebZ6LZZm65PVUZ'
        const transactionMessage = {
          version: 0,
          instructions: [
            {
              programAddress: '11111111111111111111111111111111',
              accounts: [],
              data: new Uint8Array([])
            }
          ],
          feePayer: differentAddress,
          lifetimeConstraint: {
            blockhash: 'HhqkdqemrKDK5Wd4oiCtzfpBWfdGS79YhLtzAck5Nz7T',
            lastValidBlockHeight: 100000n
          }
        }

        await expect(
          readOnlyAccount.quoteSendTransaction(transactionMessage)
        ).rejects.toThrow(
          `Transaction fee payer (${differentAddress}) does not match wallet address (${TEST_ADDRESS})`
        )

        expect(mockRpc.getFeeForMessage).not.toHaveBeenCalled()
      })

      it('should add feePayer when missing from TransactionMessage', async () => {
        const transactionMessage = {
          version: 0,
          instructions: [
            {
              programAddress: '11111111111111111111111111111111',
              accounts: [],
              data: new Uint8Array([])
            }
          ],
          lifetimeConstraint: {
            blockhash: 'HhqkdqemrKDK5Wd4oiCtzfpBWfdGS79YhLtzAck5Nz7T',
            lastValidBlockHeight: 100000n
          }
        }

        const result =
          await readOnlyAccount.quoteSendTransaction(transactionMessage)

        expect(result).toEqual({ fee: 5000n })
        expect(mockRpc.getFeeForMessage).toHaveBeenCalledTimes(1)
      })

      it('should handle RPC error when fetching latest blockhash for TransactionMessage', async () => {
        mockRpc.getLatestBlockhash.mockReturnValue({
          send: jest
            .fn()
            .mockRejectedValue(new Error('Blockhash fetch failed'))
        })

        const transactionMessage = {
          version: 0,
          instructions: [
            {
              programAddress: '11111111111111111111111111111111',
              accounts: [],
              data: new Uint8Array([])
            }
          ]
        }

        await expect(
          readOnlyAccount.quoteSendTransaction(transactionMessage)
        ).rejects.toThrow('Blockhash fetch failed')
      })

      it('should handle RPC error when calculating fee for TransactionMessage', async () => {
        mockRpc.getFeeForMessage.mockReturnValue({
          send: jest
            .fn()
            .mockRejectedValue(new Error('Fee calculation failed'))
        })

        const transactionMessage = {
          version: 0,
          instructions: [
            {
              programAddress: '11111111111111111111111111111111',
              accounts: [],
              data: new Uint8Array([])
            }
          ],
          feePayer: TEST_ADDRESS,
          lifetimeConstraint: {
            blockhash: 'HhqkdqemrKDK5Wd4oiCtzfpBWfdGS79YhLtzAck5Nz7T',
            lastValidBlockHeight: 100000n
          }
        }

        await expect(
          readOnlyAccount.quoteSendTransaction(transactionMessage)
        ).rejects.toThrow('Fee calculation failed')
      })

      it('should throw error when getFeeForMessage returns null for TransactionMessage', async () => {
        mockRpc.getFeeForMessage.mockReturnValue({
          send: jest.fn().mockResolvedValue({ value: null })
        })

        const transactionMessage = {
          version: 0,
          instructions: [
            {
              programAddress: '11111111111111111111111111111111',
              accounts: [],
              data: new Uint8Array([])
            }
          ],
          feePayer: TEST_ADDRESS,
          lifetimeConstraint: {
            blockhash: 'HhqkdqemrKDK5Wd4oiCtzfpBWfdGS79YhLtzAck5Nz7T',
            lastValidBlockHeight: 100000n
          }
        }

        await expect(
          readOnlyAccount.quoteSendTransaction(transactionMessage)
        ).rejects.toThrow('Failed to calculate transaction fee')
      })
    })

    describe('Error Handling', () => {
      it('should throw error when not connected to provider', async () => {
        const disconnectedAccount = new WalletAccountReadOnlySolana(
          TEST_ADDRESS,
          {}
        )
        const tx = {
          to: '3gx5puA146Y1jb6dV4KS8vQnXtuXSZsAPV89JeaqfFXW',
          value: 1000n
        }

        await expect(
          disconnectedAccount.quoteSendTransaction(tx)
        ).rejects.toThrow(
          'The wallet must be connected to a provider to quote transactions.'
        )
      })
    })
  })

  describe('quoteTransfer', () => {
    const MOCK_TOKEN_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'
    const MOCK_RECIPIENT = 'HmWPZeFgxZAJQYgwh5ipYwjbVTHtjEHB3dnJ5xcQBHX9'

    beforeEach(() => {
      mockRpc.getLatestBlockhash.mockReturnValue({
        send: jest.fn().mockResolvedValue({
          value: {
            blockhash: 'HhqkdqemrKDK5Wd4oiCtzfpBWfdGS79YhLtzAck5Nz7T',
            lastValidBlockHeight: 100000n
          }
        })
      })
    })

    it('should quote fee when recipient ATA exists', async () => {
      mockRpc.getAccountInfo
        .mockReturnValueOnce({
          send: jest.fn().mockResolvedValue({
            value: {
              owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
              lamports: 2039280n,
              data: [Buffer.alloc(165).toString('base64'), 'base64']
            }
          })
        })
        .mockReturnValueOnce({
          send: jest.fn().mockResolvedValue({
            value: {
              owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
              lamports: 2039280n,
              data: [Buffer.alloc(165).toString('base64'), 'base64']
            }
          })
        })
        .mockReturnValueOnce({
          send: jest.fn().mockResolvedValue({
            value: {
              owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
              lamports: 2039280n,
              data: [Buffer.alloc(82).toString('base64'), 'base64']
            }
          })
        })

      mockRpc.getFeeForMessage.mockReturnValue({
        send: jest.fn().mockResolvedValue({ value: 5000n })
      })

      const result = await readOnlyAccount.quoteTransfer({
        token: MOCK_TOKEN_MINT,
        recipient: MOCK_RECIPIENT,
        amount: 1000000n
      })

      expect(result).toEqual({ fee: 5000n })
    })

    it('should quote fee when recipient ATA does not exist', async () => {
      mockRpc.getAccountInfo
        .mockReturnValueOnce({
          send: jest.fn().mockResolvedValue({ value: null })
        })
        .mockReturnValueOnce({
          send: jest.fn().mockResolvedValue({
            value: {
              owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
              lamports: 2039280n,
              data: [Buffer.alloc(165).toString('base64'), 'base64']
            }
          })
        })
        .mockReturnValueOnce({
          send: jest.fn().mockResolvedValue({
            value: {
              owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
              lamports: 2039280n,
              data: [Buffer.alloc(82).toString('base64'), 'base64']
            }
          })
        })

      mockRpc.getFeeForMessage.mockReturnValue({
        send: jest.fn().mockResolvedValue({ value: 7000n })
      })

      const result = await readOnlyAccount.quoteTransfer({
        token: MOCK_TOKEN_MINT,
        recipient: MOCK_RECIPIENT,
        amount: 1000000n
      })

      expect(result.fee).toBe(7000n)
    })

    it('should handle number amount', async () => {
      mockRpc.getAccountInfo
        .mockReturnValueOnce({
          send: jest.fn().mockResolvedValue({
            value: {
              owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
              lamports: 2039280n,
              data: [Buffer.alloc(165).toString('base64'), 'base64']
            }
          })
        })
        .mockReturnValueOnce({
          send: jest.fn().mockResolvedValue({
            value: {
              owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
              lamports: 2039280n,
              data: [Buffer.alloc(165).toString('base64'), 'base64']
            }
          })
        })
        .mockReturnValueOnce({
          send: jest.fn().mockResolvedValue({
            value: {
              owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
              lamports: 2039280n,
              data: [Buffer.alloc(82).toString('base64'), 'base64']
            }
          })
        })

      mockRpc.getFeeForMessage.mockReturnValue({
        send: jest.fn().mockResolvedValue({ value: 5000n })
      })

      const result = await readOnlyAccount.quoteTransfer({
        token: MOCK_TOKEN_MINT,
        recipient: MOCK_RECIPIENT,
        amount: 1000000
      })

      expect(result.fee).toBe(5000n)
    })

    it('should throw error when not connected to provider', async () => {
      const disconnectedAccount = new WalletAccountReadOnlySolana(
        TEST_ADDRESS,
        {}
      )

      await expect(
        disconnectedAccount.quoteTransfer({
          token: MOCK_TOKEN_MINT,
          recipient: MOCK_RECIPIENT,
          amount: 1000000n
        })
      ).rejects.toThrow(
        'The wallet must be connected to a provider to quote transfer operations.'
      )
    })

    it('should throw error when getFeeForMessage returns null', async () => {
      mockRpc.getAccountInfo
        .mockReturnValueOnce({
          send: jest.fn().mockResolvedValue({ value: null })
        })
        .mockReturnValueOnce({
          send: jest.fn().mockResolvedValue({
            value: {
              owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
              lamports: 2039280n,
              data: [Buffer.alloc(165).toString('base64'), 'base64']
            }
          })
        })
        .mockReturnValueOnce({
          send: jest.fn().mockResolvedValue({
            value: {
              owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
              lamports: 2039280n,
              data: [Buffer.alloc(82).toString('base64'), 'base64']
            }
          })
        })

      mockRpc.getFeeForMessage.mockReturnValue({
        send: jest.fn().mockResolvedValue({ value: null })
      })

      await expect(
        readOnlyAccount.quoteTransfer({
          token: MOCK_TOKEN_MINT,
          recipient: MOCK_RECIPIENT,
          amount: 1000000n
        })
      ).rejects.toThrow('Failed to calculate transaction fee')
    })
  })

  describe('getTransactionReceipt', () => {
    const MOCK_TX_SIGNATURE =
      '2k3dxVsXko3Vtb7z2W31GHCbZBzRXCAo5YYqbn7bxUCQM1RQb5Xq1XhWndFGhZGpZ5mGARUx5kavWqFVoBGujpWf'

    it('should return transaction receipt', async () => {
      const mockReceipt = {
        slot: 123456n,
        transaction: {
          message: {
            accountKeys: [],
            header: {
              numRequiredSignatures: 1,
              numReadonlySignedAccounts: 0,
              numReadonlyUnsignedAccounts: 1
            },
            instructions: [],
            recentBlockhash: 'HhqkdqemrKDK5Wd4oiCtzfpBWfdGS79YhLtzAck5Nz7T'
          },
          signatures: [MOCK_TX_SIGNATURE]
        },
        meta: {
          err: null,
          fee: 5000n,
          preBalances: [1000000000n],
          postBalances: [999995000n],
          innerInstructions: [],
          logMessages: [],
          preTokenBalances: [],
          postTokenBalances: [],
          rewards: []
        },
        blockTime: 1234567890n
      }

      mockRpc.getTransaction.mockReturnValue({
        send: jest.fn().mockResolvedValue(mockReceipt)
      })

      const receipt =
        await readOnlyAccount.getTransactionReceipt(MOCK_TX_SIGNATURE)

      expect(receipt).toEqual(mockReceipt)
      expect(receipt.slot).toBe(123456n)
      expect(receipt.meta.fee).toBe(5000n)
      expect(receipt.meta.err).toBeNull()

      expect(mockRpc.getTransaction).toHaveBeenCalledTimes(1)
      expect(mockRpc.getTransaction).toHaveBeenCalledWith(
        MOCK_TX_SIGNATURE,
        expect.objectContaining({
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0
        })
      )
    })

    it('should return null for non-existent transaction', async () => {
      mockRpc.getTransaction.mockReturnValue({
        send: jest.fn().mockResolvedValue(null)
      })

      const receipt =
        await readOnlyAccount.getTransactionReceipt(MOCK_TX_SIGNATURE)

      expect(receipt).toBeNull()
      expect(mockRpc.getTransaction).toHaveBeenCalledTimes(1)
    })

    it('should throw error when not connected to provider', async () => {
      const disconnectedAccount = new WalletAccountReadOnlySolana(
        TEST_ADDRESS,
        {}
      )

      await expect(
        disconnectedAccount.getTransactionReceipt(MOCK_TX_SIGNATURE)
      ).rejects.toThrow(
        'The wallet must be connected to a provider to fetch transaction receipts.'
      )
    })

    it('should throw error when getTransaction fails', async () => {
      mockRpc.getTransaction.mockReturnValue({
        send: jest
          .fn()
          .mockRejectedValue(
            new Error('RPC error: Failed to fetch transaction')
          )
      })

      await expect(
        readOnlyAccount.getTransactionReceipt(MOCK_TX_SIGNATURE)
      ).rejects.toThrow('RPC error: Failed to fetch transaction')

      expect(mockRpc.getTransaction).toHaveBeenCalledTimes(1)
    })
    it('should throw error for invalid signature format', async () => {
      const invalidSignature = 'invalid-signature'

      await expect(
        readOnlyAccount.getTransactionReceipt(invalidSignature)
      ).rejects.toThrow()
    })
  })

  describe('verify', () => {
    it('should verify signature for same message across multiple verifications', async () => {
      const account = await WalletAccountSolana.at(
        TEST_SEED_PHRASE,
        "0'/0'/0'",
        {
          rpcUrl: TEST_RPC_URL,
          commitment: 'processed'
        }
      )
      const message = 'Persistent message'
      const signature = await account.sign(message)

      const readOnlyAccount = new WalletAccountReadOnlySolana(
        await account.getAddress(),
        {}
      )
      const isValid1 = await readOnlyAccount.verify(message, signature)
      const isValid2 = await readOnlyAccount.verify(message, signature)
      const isValid3 = await readOnlyAccount.verify(message, signature)

      expect(isValid1).toBe(true)
      expect(isValid2).toBe(true)
      expect(isValid3).toBe(true)

      account.dispose()
    })

    it('should reject signature for different message', async () => {
      const account = await WalletAccountSolana.at(
        TEST_SEED_PHRASE,
        "0'/0'/0'",
        {
          rpcUrl: TEST_RPC_URL,
          commitment: 'processed'
        }
      )
      const message1 = 'Message 1'
      const message2 = 'Message 2'
      const signature1 = await account.sign(message1)

      const readOnlyAccount = new WalletAccountReadOnlySolana(
        await account.getAddress(),
        {}
      )
      expect(await readOnlyAccount.verify(message1, signature1)).toBe(true)
      expect(await readOnlyAccount.verify(message2, signature1)).toBe(false)

      account.dispose()
    })

    it('should reject invalid hex signature', async () => {
      const message = 'Test message'
      const invalidSignature = 'not-a-valid-hex-signature'

      const readOnlyAccount = new WalletAccountReadOnlySolana(
        TEST_ACCOUNT_ADDRESS,
        {}
      )
      expect(await readOnlyAccount.verify(message, invalidSignature)).toBe(
        false
      )
    })
  })
})
