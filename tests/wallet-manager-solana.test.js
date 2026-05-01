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

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest
} from '@jest/globals'
import WalletManagerSolana from '../src/wallet-manager-solana.js'
import WalletAccountSolana from '../src/wallet-account-solana.js'

const TEST_SEED_PHRASE =
  'test walk nut penalty hip pave soap entry language right filter choice'
const TEST_RPC_URL = 'https://mock-url.com'

describe('WalletManagerSolana', () => {
  let wallet

  beforeEach(() => {
    wallet = new WalletManagerSolana(TEST_SEED_PHRASE, {
      rpcUrl: TEST_RPC_URL,
      commitment: 'confirmed'
    })
  })

  describe('Constructor', () => {
    it('should create wallet manager with valid config', () => {
      expect(wallet).toBeInstanceOf(WalletManagerSolana)
      expect(wallet._rpc).toBeDefined()
    })

    it('should create wallet manager with string seed phrase', () => {
      const newWallet = new WalletManagerSolana(TEST_SEED_PHRASE, {
        rpcUrl: TEST_RPC_URL
      })
      expect(newWallet).toBeInstanceOf(WalletManagerSolana)
    })
  })

  describe('getAccount', () => {
    it('should return account at index 0', async () => {
      const account = await wallet.getAccount(0)
      expect(account).toBeInstanceOf(WalletAccountSolana)
      expect(account.index).toBe(0)
      expect(account.path).toBe("m/44'/501'/0'/0'")
    })

    it('should return different accounts for different indices', async () => {
      const account0 = await wallet.getAccount(0)
      const account1 = await wallet.getAccount(1)
      expect(account0).not.toBe(account1)
      expect(await account0.getAddress()).not.toBe(await account1.getAddress())
    })

    it('should handle large index numbers', async () => {
      const account = await wallet.getAccount(999)
      expect(account.index).toBe(999)
      expect(account.path).toBe("m/44'/501'/999'/0'")
    })
  })

  describe('getAccountByPath', () => {
    it("should return account for path \"0'/0'/0'\"", async () => {
      const account = await wallet.getAccountByPath("0'/0'/0'")
      expect(account).toBeInstanceOf(WalletAccountSolana)
      expect(account.path).toBe("m/44'/501'/0'/0'/0'")
    })

    it('should return different accounts for different paths', async () => {
      const account1 = await wallet.getAccountByPath("0'/0'/0'")
      const account2 = await wallet.getAccountByPath("0'/0'/1'")
      expect(account1).not.toBe(account2)
      expect(await account1.getAddress()).not.toBe(await account2.getAddress())
    })
  })

  describe('getFeeRates', () => {
    let mockRpc
    let originalRpc

    beforeEach(() => {
      originalRpc = wallet._rpc

      mockRpc = {
        getRecentPrioritizationFees: jest.fn()
      }
    })

    afterEach(() => {
      wallet._rpc = originalRpc
    })

    it('should return fee rates with normal and fast', async () => {
      mockRpc.getRecentPrioritizationFees.mockReturnValue({
        send: jest.fn().mockResolvedValue([
          { slot: 1, prioritizationFee: 1000 },
          { slot: 2, prioritizationFee: 2000 },
          { slot: 3, prioritizationFee: 3000 }
        ])
      })

      wallet._rpc = mockRpc

      const feeRates = await wallet.getFeeRates()

      expect(feeRates).toBeDefined()
      expect(feeRates.normal).toBeDefined()
      expect(feeRates.fast).toBeDefined()
      expect(typeof feeRates.normal).toBe('bigint')
      expect(typeof feeRates.fast).toBe('bigint')
    })

    it('should calculate normal rate as 110% of max fee', async () => {
      mockRpc.getRecentPrioritizationFees.mockReturnValue({
        send: jest
          .fn()
          .mockResolvedValue([{ slot: 1, prioritizationFee: 1000 }])
      })

      wallet._rpc = mockRpc

      const feeRates = await wallet.getFeeRates()

      expect(feeRates.normal).toBe(1100n)
    })

    it('should calculate fast rate as 200% of max fee', async () => {
      mockRpc.getRecentPrioritizationFees.mockReturnValue({
        send: jest
          .fn()
          .mockResolvedValue([{ slot: 1, prioritizationFee: 1000 }])
      })

      wallet._rpc = mockRpc

      const feeRates = await wallet.getFeeRates()

      expect(feeRates.fast).toBe(2000n)
    })

    it('should use highest prioritization fee when multiple fees returned', async () => {
      mockRpc.getRecentPrioritizationFees.mockReturnValue({
        send: jest.fn().mockResolvedValue([
          { slot: 1, prioritizationFee: 1000 },
          { slot: 2, prioritizationFee: 5000 },
          { slot: 3, prioritizationFee: 3000 }
        ])
      })

      wallet._rpc = mockRpc

      const feeRates = await wallet.getFeeRates()

      expect(feeRates.normal).toBe(5500n)
      expect(feeRates.fast).toBe(10000n)
    })

    it('should filter out zero fees', async () => {
      mockRpc.getRecentPrioritizationFees.mockReturnValue({
        send: jest.fn().mockResolvedValue([
          { slot: 1, prioritizationFee: 0 },
          { slot: 2, prioritizationFee: 0 },
          { slot: 3, prioritizationFee: 2000 }
        ])
      })

      wallet._rpc = mockRpc

      const feeRates = await wallet.getFeeRates()

      expect(feeRates.normal).toBe(2200n)
      expect(feeRates.fast).toBe(4000n)
    })

    it('should use default fee when all fees are zero', async () => {
      mockRpc.getRecentPrioritizationFees.mockReturnValue({
        send: jest.fn().mockResolvedValue([
          { slot: 1, prioritizationFee: 0 },
          { slot: 2, prioritizationFee: 0 }
        ])
      })

      wallet._rpc = mockRpc

      const feeRates = await wallet.getFeeRates()

      expect(feeRates.normal).toBe(5500n)
      expect(feeRates.fast).toBe(10000n)
    })

    it('should use default fee when no fees returned', async () => {
      mockRpc.getRecentPrioritizationFees.mockReturnValue({
        send: jest.fn().mockResolvedValue([])
      })

      wallet._rpc = mockRpc

      const feeRates = await wallet.getFeeRates()

      expect(feeRates.normal).toBe(5500n)
      expect(feeRates.fast).toBe(10000n)
    })

    it('should throw error when no RPC connection', async () => {
      const noRpcWallet = new WalletManagerSolana(TEST_SEED_PHRASE)

      await expect(noRpcWallet.getFeeRates()).rejects.toThrow(
        'The wallet must be connected to a provider to get fee rates'
      )
    })

    it('should handle RPC errors gracefully', async () => {
      mockRpc.getRecentPrioritizationFees.mockReturnValue({
        send: jest.fn().mockRejectedValue(new Error('RPC connection failed'))
      })

      wallet._rpc = mockRpc

      await expect(wallet.getFeeRates()).rejects.toThrow(
        'RPC connection failed'
      )
    })
  })
})
