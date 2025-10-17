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

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import WalletAccountReadOnlySolana from '../src/wallet-account-read-only-solana.js'
import { Transaction, SystemProgram, VersionedTransaction, TransactionMessage, PublicKey } from '@solana/web3.js'

const TEST_ADDRESS = 'HmWPZeFgxZAJQYgwh5ipYwjbVTHtjEHB3dnJ5xcQBHX9'
const TEST_RPC_URL = 'https://mockurl.com'

describe('WalletAccountReadOnlySolana', () => {
  let readOnlyAccount

  beforeEach(() => {
    readOnlyAccount = new WalletAccountReadOnlySolana(TEST_ADDRESS, {
      rpcUrl: TEST_RPC_URL,
      commitment: 'confirmed'
    })
  })

  describe('Constructor', () => {
    it('should create instance with valid config', () => {
      expect(readOnlyAccount).toBeInstanceOf(WalletAccountReadOnlySolana)
      expect(readOnlyAccount._connection).toBeDefined()
    })

    it('should throw if no rpcUrl provided', () => {
      const account = new WalletAccountReadOnlySolana(TEST_ADDRESS, {})
      expect(account._connection).toBeUndefined()
    })
  })

  describe('getBalance', () => {
    let originalGetBalance

    beforeEach(() => {
      originalGetBalance = readOnlyAccount._connection.getBalance
    })

    afterEach(() => {
      if (originalGetBalance) {
        readOnlyAccount._connection.getBalance = originalGetBalance
      }
    })

    it('should return SOL balance in lamports', async () => {
      // Mock getBalance to return 1 SOL (1,000,000,000 lamports)
      readOnlyAccount._connection.getBalance = jest.fn().mockResolvedValue(1000000000)

      const balance = await readOnlyAccount.getBalance()

      expect(balance).toBe(1000000000n)
      expect(readOnlyAccount._connection.getBalance).toHaveBeenCalledTimes(1)
    })

    it('should return zero balance for empty account', async () => {
      readOnlyAccount._connection.getBalance = jest.fn().mockResolvedValue(0)

      const balance = await readOnlyAccount.getBalance()

      expect(balance).toBe(0n)
    })

    it('should throw error when not connected to provider', async () => {
      const disconnectedAccount = new WalletAccountReadOnlySolana(TEST_ADDRESS, {})

      await expect(disconnectedAccount.getBalance()).rejects.toThrow(
        'The wallet must be connected to a provider to retrieve balances.'
      )
    })

    it('should handle RPC errors gracefully', async () => {
      readOnlyAccount._connection.getBalance = jest.fn().mockRejectedValue(
        new Error('RPC error')
      )

      await expect(readOnlyAccount.getBalance()).rejects.toThrow('RPC error')
    })

    it('should handle multiple consecutive calls', async () => {
      readOnlyAccount._connection.getBalance = jest.fn()
        .mockResolvedValueOnce(1000000000)
        .mockResolvedValueOnce(2000000000)
        .mockResolvedValueOnce(3000000000)

      const balance1 = await readOnlyAccount.getBalance()
      const balance2 = await readOnlyAccount.getBalance()
      const balance3 = await readOnlyAccount.getBalance()

      expect(balance1).toBe(1000000000n)
      expect(balance2).toBe(2000000000n)
      expect(balance3).toBe(3000000000n)
      expect(readOnlyAccount._connection.getBalance).toHaveBeenCalledTimes(3)
    })
  })

  describe('getTokenBalance', () => {
    const MOCK_TOKEN_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB' // USDT mint
    let originalGetAccountInfo
    let originalGetTokenAccountBalance

    beforeEach(() => {
      originalGetAccountInfo = readOnlyAccount._connection.getAccountInfo
      originalGetTokenAccountBalance = readOnlyAccount._connection.getTokenAccountBalance
    })

    afterEach(() => {
      if (originalGetAccountInfo) {
        readOnlyAccount._connection.getAccountInfo = originalGetAccountInfo
      }
      if (originalGetTokenAccountBalance) {
        readOnlyAccount._connection.getTokenAccountBalance = originalGetTokenAccountBalance
      }
    })

    it('should return token balance when ATA exists', async () => {
      // Mock ATA exists
      readOnlyAccount._connection.getAccountInfo = jest.fn().mockResolvedValue({
        owner: { toBase58: () => 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
        lamports: 2039280,
        data: Buffer.alloc(165)
      })

      // Mock token balance (1 USDT with 6 decimals = 1000000)
      readOnlyAccount._connection.getTokenAccountBalance = jest.fn().mockResolvedValue({
        context: { slot: 123456 },
        value: {
          amount: '1000000',
          decimals: 6,
          uiAmount: 1.0,
          uiAmountString: '1.0'
        }
      })

      const balance = await readOnlyAccount.getTokenBalance(MOCK_TOKEN_MINT)

      expect(balance).toBe(1000000n)
      expect(readOnlyAccount._connection.getAccountInfo).toHaveBeenCalledTimes(1)
      expect(readOnlyAccount._connection.getTokenAccountBalance).toHaveBeenCalledTimes(1)
    })

    it('should return zero when ATA does not exist', async () => {
      // Mock ATA doesn't exist
      readOnlyAccount._connection.getAccountInfo = jest.fn().mockResolvedValue(null)
      readOnlyAccount._connection.getTokenAccountBalance = jest.fn()

      const balance = await readOnlyAccount.getTokenBalance(MOCK_TOKEN_MINT)

      expect(balance).toBe(0n)
      expect(readOnlyAccount._connection.getAccountInfo).toHaveBeenCalledTimes(1)
      expect(readOnlyAccount._connection.getTokenAccountBalance).not.toHaveBeenCalled()
    })

    it('should return zero balance when ATA exists but has no tokens', async () => {
      readOnlyAccount._connection.getAccountInfo = jest.fn().mockResolvedValue({
        owner: { toBase58: () => 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
        lamports: 2039280,
        data: Buffer.alloc(165)
      })

      readOnlyAccount._connection.getTokenAccountBalance = jest.fn().mockResolvedValue({
        context: { slot: 123456 },
        value: {
          amount: '0',
          decimals: 6,
          uiAmount: 0,
          uiAmountString: '0'
        }
      })

      const balance = await readOnlyAccount.getTokenBalance(MOCK_TOKEN_MINT)

      expect(balance).toBe(0n)
    })

    it('should throw error when not connected to provider', async () => {
      const disconnectedAccount = new WalletAccountReadOnlySolana(TEST_ADDRESS, {})

      await expect(disconnectedAccount.getTokenBalance(MOCK_TOKEN_MINT)).rejects.toThrow(
        'The wallet must be connected to a provider to retrieve token balances.'
      )
    })

    it('should throw error for invalid token mint address', async () => {
      const invalidMint = 'invalid-mint-address'

      await expect(readOnlyAccount.getTokenBalance(invalidMint)).rejects.toThrow()
    })

    it('should throw error when getAccountInfo fails', async () => {
      readOnlyAccount._connection.getAccountInfo = jest.fn().mockRejectedValue(
        new Error('RPC error: Failed to fetch account info')
      )

      await expect(readOnlyAccount.getTokenBalance(MOCK_TOKEN_MINT)).rejects.toThrow(
        'RPC error: Failed to fetch account info'
      )
    })

    it('should throw error when getTokenAccountBalance fails', async () => {
      readOnlyAccount._connection.getAccountInfo = jest.fn().mockResolvedValue({
        owner: { toBase58: () => 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
        lamports: 2039280,
        data: Buffer.alloc(165)
      })

      readOnlyAccount._connection.getTokenAccountBalance = jest.fn().mockRejectedValue(
        new Error('Failed to get token balance')
      )

      await expect(readOnlyAccount.getTokenBalance(MOCK_TOKEN_MINT)).rejects.toThrow(
        'Failed to get token balance'
      )
    })

    it('should handle multiple token balance checks', async () => {
      readOnlyAccount._connection.getAccountInfo = jest.fn().mockResolvedValue({
        owner: { toBase58: () => 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
        lamports: 2039280,
        data: Buffer.alloc(165)
      })

      readOnlyAccount._connection.getTokenAccountBalance = jest.fn()
        .mockResolvedValueOnce({
          context: { slot: 123456 },
          value: { amount: '1000000', decimals: 6, uiAmount: 1.0, uiAmountString: '1.0' }
        })
        .mockResolvedValueOnce({
          context: { slot: 123457 },
          value: { amount: '2000000', decimals: 6, uiAmount: 2.0, uiAmountString: '2.0' }
        })

      const balance1 = await readOnlyAccount.getTokenBalance(MOCK_TOKEN_MINT)
      const balance2 = await readOnlyAccount.getTokenBalance(MOCK_TOKEN_MINT)

      expect(balance1).toBe(1000000n)
      expect(balance2).toBe(2000000n)
    })

    it('should handle different token mints', async () => {
      const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'
      const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

      readOnlyAccount._connection.getAccountInfo = jest.fn().mockResolvedValue({
        owner: { toBase58: () => 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
        lamports: 2039280,
        data: Buffer.alloc(165)
      })

      readOnlyAccount._connection.getTokenAccountBalance = jest.fn()
        .mockResolvedValueOnce({
          context: { slot: 123456 },
          value: { amount: '1000000', decimals: 6, uiAmount: 1.0, uiAmountString: '1.0' }
        })
        .mockResolvedValueOnce({
          context: { slot: 123457 },
          value: { amount: '5000000', decimals: 6, uiAmount: 5.0, uiAmountString: '5.0' }
        })

      const usdtBalance = await readOnlyAccount.getTokenBalance(USDT_MINT)
      const usdcBalance = await readOnlyAccount.getTokenBalance(USDC_MINT)

      expect(usdtBalance).toBe(1000000n)
      expect(usdcBalance).toBe(5000000n)
    })
  })

  describe('quoteSendTransaction', () => {
    let originalGetFeeForMessage

    beforeEach(() => {
      originalGetFeeForMessage = readOnlyAccount._connection.getFeeForMessage
    })

    afterEach(() => {
      if (originalGetFeeForMessage) {
        readOnlyAccount._connection.getFeeForMessage = originalGetFeeForMessage
      }
    })

    describe('Legacy Transaction', () => {
      it('should quote fee for legacy transaction', async () => {
        const tx = new Transaction()
        const recipient = new PublicKey('11111111111111111111111111111112')
        const sender = new PublicKey(TEST_ADDRESS)

        tx.add(
          SystemProgram.transfer({
            fromPubkey: sender,
            toPubkey: recipient,
            lamports: 1000
          })
        )
        tx.recentBlockhash = 'HhqkdqemrKDK5Wd4oiCtzfpBWfdGS79YhLtzAck5Nz7T'
        tx.feePayer = new PublicKey(TEST_ADDRESS)

        readOnlyAccount._connection.getFeeForMessage = jest.fn().mockResolvedValue({
          value: 5000
        })

        const result = await readOnlyAccount.quoteSendTransaction(tx)

        expect(result).toEqual({ fee: 5000n })
        expect(readOnlyAccount._connection.getFeeForMessage).toHaveBeenCalledTimes(1)
      })

      it('should handle transaction without blockhash', async () => {
        const tx = new Transaction()
        const recipient = new PublicKey('11111111111111111111111111111112')
        const sender = new PublicKey(TEST_ADDRESS)

        tx.add(
          SystemProgram.transfer({
            fromPubkey: sender,
            toPubkey: recipient,
            lamports: 1000
          })
        )

        readOnlyAccount._connection.getFeeForMessage = jest.fn().mockResolvedValue({
          value: 5000
        })
        readOnlyAccount._connection.getLatestBlockhash = jest.fn().mockResolvedValue({
          blockhash: 'HhqkdqemrKDK5Wd4oiCtzfpBWfdGS79YhLtzAck5Nz7T',
          lastValidBlockHeight: 100000
        })
        const result = await readOnlyAccount.quoteSendTransaction(tx)

        expect(result.fee).toBe(5000n)
        expect(readOnlyAccount._connection.getFeeForMessage).toHaveBeenCalledTimes(1)
        expect(readOnlyAccount._connection.getLatestBlockhash).toHaveBeenCalledTimes(1)
      })
    })

    describe('VersionedTransaction', () => {
      it('should quote fee for versioned transaction', async () => {
        const sender = new PublicKey(TEST_ADDRESS)
        const recipient = new PublicKey('11111111111111111111111111111112')

        const messageV0 = new TransactionMessage({
          payerKey: sender,
          recentBlockhash: 'HhqkdqemrKDK5Wd4oiCtzfpBWfdGS79YhLtzAck5Nz7T',
          instructions: [
            SystemProgram.transfer({
              fromPubkey: sender,
              toPubkey: recipient,
              lamports: 1000
            })
          ]
        }).compileToV0Message()

        const versionedTx = new VersionedTransaction(messageV0)

        readOnlyAccount._connection.getFeeForMessage = jest.fn().mockResolvedValue({
          value: 5000
        })

        const result = await readOnlyAccount.quoteSendTransaction(versionedTx)

        expect(result).toEqual({ fee: 5000n })
        expect(readOnlyAccount._connection.getFeeForMessage).toHaveBeenCalledTimes(1)
      })
    })

    describe('TransferNativeTransaction', () => {
      let originalGetLatestBlockhash
      let originalGetFeeForMessage

      beforeEach(() => {
        originalGetLatestBlockhash = readOnlyAccount._connection.getLatestBlockhash
        originalGetFeeForMessage = readOnlyAccount._connection.getFeeForMessage

        readOnlyAccount._connection.getLatestBlockhash = jest.fn().mockResolvedValue({
          blockhash: 'HhqkdqemrKDK5Wd4oiCtzfpBWfdGS79YhLtzAck5Nz7T',
          lastValidBlockHeight: 100000
        })

        readOnlyAccount._connection.getFeeForMessage = jest.fn().mockResolvedValue({
          value: 5000
        })
      })

      afterEach(() => {
        if (originalGetLatestBlockhash) {
          readOnlyAccount._connection.getLatestBlockhash = originalGetLatestBlockhash
        }
        if (originalGetFeeForMessage) {
          readOnlyAccount._connection.getFeeForMessage = originalGetFeeForMessage
        }
      })

      it('should quote fee for native SOL transfer with bigint value', async () => {
        const nativeTx = {
          to: '11111111111111111111111111111111',
          value: 1000000000n // 1 SOL
        }

        const result = await readOnlyAccount.quoteSendTransaction(nativeTx)

        expect(result).toEqual({ fee: 5000n })
        expect(typeof result.fee).toBe('bigint')
        expect(readOnlyAccount._connection.getLatestBlockhash).toHaveBeenCalledTimes(1)
        expect(readOnlyAccount._connection.getFeeForMessage).toHaveBeenCalledTimes(1)
      })

      it('should throw error for invalid recipient address', async () => {
        const invalidTx = { to: 'invalid-address', value: 1000 }

        await expect(readOnlyAccount.quoteSendTransaction(invalidTx)).rejects.toThrow(
          'Non-base58 character'
        )
      })

      it('should throw error for negative value', async () => {
        const invalidTx = {
          to: '11111111111111111111111111111111',
          value: -1000
        }

        await expect(readOnlyAccount.quoteSendTransaction(invalidTx)).rejects.toThrow(
          'Codec [u64] expected number to be in the range'
        )
      })

      it('should handle getLatestBlockhash failure', async () => {
        readOnlyAccount._connection.getLatestBlockhash = jest.fn().mockRejectedValue(
          new Error('Network error')
        )

        const nativeTx = {
          to: '11111111111111111111111111111111',
          value: 1000000n
        }

        await expect(readOnlyAccount.quoteSendTransaction(nativeTx)).rejects.toThrow(
          'Network error'
        )
      })

      it('should handle getFeeForMessage failure', async () => {
        readOnlyAccount._connection.getFeeForMessage = jest.fn().mockRejectedValue(
          new Error('Failed to calculate fee')
        )

        const nativeTx = {
          to: '11111111111111111111111111111111',
          value: 1000000n
        }

        await expect(readOnlyAccount.quoteSendTransaction(nativeTx)).rejects.toThrow(
          'Failed to calculate fee'
        )
      })

      it('should handle multiple consecutive native transfers', async () => {
        readOnlyAccount._connection.getFeeForMessage = jest.fn()
          .mockResolvedValueOnce({ value: 5000 })
          .mockResolvedValueOnce({ value: 6000 })
          .mockResolvedValueOnce({ value: 7000 })

        const nativeTx1 = { to: '11111111111111111111111111111111', value: 1000000n }
        const nativeTx2 = { to: '11111111111111111111111111111111', value: 2000000n }
        const nativeTx3 = { to: '11111111111111111111111111111111', value: 3000000n }

        const result1 = await readOnlyAccount.quoteSendTransaction(nativeTx1)
        const result2 = await readOnlyAccount.quoteSendTransaction(nativeTx2)
        const result3 = await readOnlyAccount.quoteSendTransaction(nativeTx3)

        expect(result1.fee).toBe(5000n)
        expect(result2.fee).toBe(6000n)
        expect(result3.fee).toBe(7000n)
      })
    })

    describe('Error Handling', () => {
      it('should throw error when not connected to provider', async () => {
        const disconnectedAccount = new WalletAccountReadOnlySolana(TEST_ADDRESS, {})
        const tx = new Transaction()

        await expect(disconnectedAccount.quoteSendTransaction(tx)).rejects.toThrow(
          'The wallet must be connected to a provider to quote transactions.'
        )
      })

      it('should throw if invalid tx format', async () => {
        const nativeTx = {
          to: '11111111111111111111111111111111',
        }

        await expect(readOnlyAccount.quoteSendTransaction(nativeTx)).rejects.toThrow(
          'Invalid transaction object. Must be { to, value }, Transaction, or VersionedTransaction'
        )
      })

    })
  })

  describe('quoteTransfer', () => {
    const MOCK_TOKEN_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'
    const MOCK_RECIPIENT = 'HmWPZeFgxZAJQYgwh5ipYwjbVTHtjEHB3dnJ5xcQBHX9'
    let originalGetAccountInfo
    let originalGetLatestBlockhash
    let originalGetFeeForMessage

    beforeEach(() => {
      originalGetAccountInfo = readOnlyAccount._connection.getAccountInfo
      originalGetLatestBlockhash = readOnlyAccount._connection.getLatestBlockhash
      originalGetFeeForMessage = readOnlyAccount._connection.getFeeForMessage
    })

    afterEach(() => {
      if (originalGetAccountInfo) {
        readOnlyAccount._connection.getAccountInfo = originalGetAccountInfo
      }
      if (originalGetLatestBlockhash) {
        readOnlyAccount._connection.getLatestBlockhash = originalGetLatestBlockhash
      }
      if (originalGetFeeForMessage) {
        readOnlyAccount._connection.getFeeForMessage = originalGetFeeForMessage
      }
    })

    it('should quote fee when recipient ATA exists', async () => {
      readOnlyAccount._connection.getAccountInfo = jest.fn().mockResolvedValue({
        owner: { toBase58: () => 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
        lamports: 2039280,
        data: Buffer.alloc(165)
      })

      readOnlyAccount._connection.getLatestBlockhash = jest.fn().mockResolvedValue({
        blockhash: 'HhqkdqemrKDK5Wd4oiCtzfpBWfdGS79YhLtzAck5Nz7T',
        lastValidBlockHeight: 100000
      })

      readOnlyAccount._connection.getFeeForMessage = jest.fn().mockResolvedValue({
        value: 5000
      })

      const result = await readOnlyAccount.quoteTransfer({
        token: MOCK_TOKEN_MINT,
        recipient: MOCK_RECIPIENT,
        amount: 1000000n
      })

      expect(result).toEqual({ fee: 5000n })
      expect(readOnlyAccount._connection.getAccountInfo).toHaveBeenCalledTimes(1)
      expect(readOnlyAccount._connection.getFeeForMessage).toHaveBeenCalledTimes(1)
    })

    it('should quote fee when recipient ATA does not exist', async () => {
      readOnlyAccount._connection.getAccountInfo = jest.fn().mockResolvedValue(null)

      readOnlyAccount._connection.getLatestBlockhash = jest.fn().mockResolvedValue({
        blockhash: 'HhqkdqemrKDK5Wd4oiCtzfpBWfdGS79YhLtzAck5Nz7T',
        lastValidBlockHeight: 100000
      })

      readOnlyAccount._connection.getFeeForMessage = jest.fn().mockResolvedValue({
        value: 7000 // Higher due to ATA creation
      })

      const result = await readOnlyAccount.quoteTransfer({
        token: MOCK_TOKEN_MINT,
        recipient: MOCK_RECIPIENT,
        amount: 1000000n
      })

      expect(result.fee).toBe(7000n)
      expect(readOnlyAccount._connection.getAccountInfo).toHaveBeenCalledTimes(1)
    })

    it('should throw if transfer large amount then u64', async () => {
      readOnlyAccount._connection.getAccountInfo = jest.fn().mockResolvedValue({
        owner: { toBase58: () => 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
        lamports: 2039280,
        data: Buffer.alloc(165)
      })

      readOnlyAccount._connection.getLatestBlockhash = jest.fn().mockResolvedValue({
        blockhash: 'HhqkdqemrKDK5Wd4oiCtzfpBWfdGS79YhLtzAck5Nz7T',
        lastValidBlockHeight: 100000
      })

      readOnlyAccount._connection.getFeeForMessage = jest.fn().mockResolvedValue({
        value: 5000
      })

      await expect(readOnlyAccount.quoteTransfer({
        token: MOCK_TOKEN_MINT,
        recipient: MOCK_RECIPIENT,
        amount: 10000000000000000000000000n // Large bigint
      })).rejects.toThrow('u64 too large')
    })

    it('should handle number amount', async () => {
      readOnlyAccount._connection.getAccountInfo = jest.fn().mockResolvedValue({
        owner: { toBase58: () => 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
        lamports: 2039280,
        data: Buffer.alloc(165)
      })

      readOnlyAccount._connection.getLatestBlockhash = jest.fn().mockResolvedValue({
        blockhash: 'HhqkdqemrKDK5Wd4oiCtzfpBWfdGS79YhLtzAck5Nz7T',
        lastValidBlockHeight: 100000
      })

      readOnlyAccount._connection.getFeeForMessage = jest.fn().mockResolvedValue({
        value: 5000
      })

      const result = await readOnlyAccount.quoteTransfer({
        token: MOCK_TOKEN_MINT,
        recipient: MOCK_RECIPIENT,
        amount: 1000000 // Number
      })

      expect(result.fee).toBe(5000n)
    })

    it('should throw error when not connected to provider', async () => {
      const disconnectedAccount = new WalletAccountReadOnlySolana(TEST_ADDRESS, {})

      await expect(disconnectedAccount.quoteTransfer({
        token: MOCK_TOKEN_MINT,
        recipient: MOCK_RECIPIENT,
        amount: 1000000n
      })).rejects.toThrow('The wallet must be connected to a provider to quote transfer operations.')
    })

    it('should throw error when getAccountInfo fails', async () => {
      readOnlyAccount._connection.getAccountInfo = jest.fn().mockRejectedValue(
        new Error('Network error')
      )

      await expect(readOnlyAccount.quoteTransfer({
        token: MOCK_TOKEN_MINT,
        recipient: MOCK_RECIPIENT,
        amount: 1000000n
      })).rejects.toThrow('Network error')
    })

    it('should throw error when getLatestBlockhash fails', async () => {
      readOnlyAccount._connection.getAccountInfo = jest.fn().mockResolvedValue(null)
      readOnlyAccount._connection.getLatestBlockhash = jest.fn().mockRejectedValue(
        new Error('Failed to get blockhash')
      )

      await expect(readOnlyAccount.quoteTransfer({
        token: MOCK_TOKEN_MINT,
        recipient: MOCK_RECIPIENT,
        amount: 1000000n
      })).rejects.toThrow('Failed to get blockhash')
    })

    it('should throw error when getFeeForMessage fails', async () => {
      readOnlyAccount._connection.getAccountInfo = jest.fn().mockResolvedValue(null)
      readOnlyAccount._connection.getLatestBlockhash = jest.fn().mockResolvedValue({
        blockhash: 'HhqkdqemrKDK5Wd4oiCtzfpBWfdGS79YhLtzAck5Nz7T',
        lastValidBlockHeight: 100000
      })
      readOnlyAccount._connection.getFeeForMessage = jest.fn().mockRejectedValue(
        new Error('Failed to calculate fee')
      )

      await expect(readOnlyAccount.quoteTransfer({
        token: MOCK_TOKEN_MINT,
        recipient: MOCK_RECIPIENT,
        amount: 1000000n
      })).rejects.toThrow('Failed to calculate fee')
    })
  })

  describe('getTransactionReceipt', () => {
    const MOCK_TX_SIGNATURE = '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW'
    let originalGetTransaction

    beforeEach(() => {
      originalGetTransaction = readOnlyAccount._connection.getTransaction
    })

    afterEach(() => {
      if (originalGetTransaction) {
        readOnlyAccount._connection.getTransaction = originalGetTransaction
      }
    })

    it('should return transaction receipt', async () => {
      const mockReceipt = {
        slot: 123456,
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
          fee: 5000,
          preBalances: [1000000000],
          postBalances: [999995000],
          innerInstructions: [],
          logMessages: [],
          preTokenBalances: [],
          postTokenBalances: [],
          rewards: []
        },
        blockTime: 1234567890
      }

      readOnlyAccount._connection.getTransaction = jest.fn().mockResolvedValue(mockReceipt)

      const receipt = await readOnlyAccount.getTransactionReceipt(MOCK_TX_SIGNATURE)

      expect(receipt).toEqual(mockReceipt)
      expect(receipt.slot).toBe(123456)
      expect(receipt.meta.fee).toBe(5000)
      expect(receipt.meta.err).toBeNull()
      expect(readOnlyAccount._connection.getTransaction).toHaveBeenCalledWith(
        MOCK_TX_SIGNATURE,
        expect.objectContaining({
          commitment: 'confirmed'
        })
      )
    })

    it('should return null for non-existent transaction', async () => {
      readOnlyAccount._connection.getTransaction = jest.fn().mockResolvedValue(null)

      const receipt = await readOnlyAccount.getTransactionReceipt(MOCK_TX_SIGNATURE)

      expect(receipt).toBeNull()
      expect(readOnlyAccount._connection.getTransaction).toHaveBeenCalledTimes(1)
    })

    it('should throw error when not connected to provider', async () => {
      const disconnectedAccount = new WalletAccountReadOnlySolana(TEST_ADDRESS, {})

      await expect(disconnectedAccount.getTransactionReceipt(MOCK_TX_SIGNATURE)).rejects.toThrow(
        'The wallet must be connected to a provider to fetch transaction receipts.'
      )
    })

    it('should throw error when getTransaction fails', async () => {
      readOnlyAccount._connection.getTransaction = jest.fn().mockRejectedValue(
        new Error('RPC error: Failed to fetch transaction')
      )

      await expect(readOnlyAccount.getTransactionReceipt(MOCK_TX_SIGNATURE)).rejects.toThrow(
        'RPC error: Failed to fetch transaction'
      )
    })
  })
})