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
import * as bip39 from 'bip39'
import { InvalidSignerError } from '@tetherto/wdk-wallet'
import WalletManagerSolana from '../src/wallet-manager-solana.js'
import WalletAccountSolana from '../src/wallet-account-solana.js'
import SeedSignerSolana from '../src/signers/seed-signer-solana.js'
import PrivateKeySignerSolana from '../src/signers/private-key-signer-solana.js'

const TEST_SEED_PHRASE =
  'test walk nut penalty hip pave soap entry language right filter choice'
const TEST_RPC_URL = 'https://mock-url.com'

const TEST_SEED = bip39.mnemonicToSeedSync(TEST_SEED_PHRASE)

const PRIVATE_KEY = 'de705bcaa34a2ea50c0b7e6e584006f2458652fa9d6e20994ac146852490c76f'
const PRIVATE_KEY_ADDRESS = '3uXqWpwgqKVdiHAwF6Vmu4G4vdQzpR66xjPkz1G7zMKE'

const ACCOUNT_0 = {
  path: "m/44'/501'/0'/0'",
  address: '3uXqWpwgqKVdiHAwF6Vmu4G4vdQzpR66xjPkz1G7zMKE'
}

const ACCOUNT_1 = {
  path: "m/44'/501'/1'/0'",
  address: 'CfGcujEkPVDx7yGyn1PUjxn2e353MXbLk8ixzwuJUktK'
}

const PATH_100_ADDRESS = '57hwCai22XueypvXcXKotkuAQYj2eukFcY5ymWB7Arvg'

const UNSUPPORTED_DERIVATION_MESSAGE = 'The signer does not support account derivation.'

const NON_DERIVABLE_SIGNER_MESSAGE = 'The default signer must be derivable. Non-derivable signers (e.g. private-key signers) can only be registered by name via addSigner.'

describe('WalletManagerSolana', () => {
  let wallet

  beforeEach(() => {
    wallet = new WalletManagerSolana(TEST_SEED_PHRASE, {
      provider: TEST_RPC_URL,
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
        provider: TEST_RPC_URL
      })
      expect(newWallet).toBeInstanceOf(WalletManagerSolana)
    })

    it('should derive the same accounts from a default signer as from the seed', async () => {
      const signerWallet = new WalletManagerSolana(new SeedSignerSolana(TEST_SEED_PHRASE), {
        provider: TEST_RPC_URL
      })

      const account = await signerWallet.getAccount(1)

      expect(account.path).toBe(ACCOUNT_1.path)
      expect(await account.getAddress()).toBe(ACCOUNT_1.address)
    })

    it('should throw if the default signer is not derivable', () => {
      expect(() => new WalletManagerSolana(new PrivateKeySignerSolana(PRIVATE_KEY)))
        .toThrow(new InvalidSignerError(NON_DERIVABLE_SIGNER_MESSAGE))
    })

    it('should derive the accounts of a raw seed', async () => {
      const seedWallet = new WalletManagerSolana(TEST_SEED, {
        provider: TEST_RPC_URL
      })

      const account = await seedWallet.getAccount(1)

      expect(account.path).toBe(ACCOUNT_1.path)
      expect(await account.getAddress()).toBe(ACCOUNT_1.address)
    })
  })

  describe('dispose', () => {
    it('should wipe the default signer it built from the seed', () => {
      const defaultSigner = wallet.getSigner()

      wallet.dispose()

      expect(defaultSigner.keyPair.privateKey).toBeNull()
    })

    it('should not derive accounts after dispose', async () => {
      wallet.dispose()

      await expect(wallet.getAccount(0)).rejects.toThrow()
    })

    it('should not keep the seed', () => {
      expect(wallet.seed).toBeUndefined()
    })

    it('should not wipe a default signer supplied by the caller', async () => {
      const signer = new SeedSignerSolana(TEST_SEED_PHRASE)
      const privateKey = Buffer.from(signer.keyPair.privateKey).toString('hex')
      const signerWallet = new WalletManagerSolana(signer, { provider: TEST_RPC_URL })
      await signerWallet.getAccount(0)

      signerWallet.dispose()

      expect(Buffer.from(signer.keyPair.privateKey).toString('hex')).toBe(privateKey)
    })
  })

  describe('signers', () => {
    const OTHER_SEED_PHRASE =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
    const OTHER_ACCOUNT_0_ADDRESS = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk'
    const OTHER_PATH_100_ADDRESS = 'H6r4dUP9Jj3CLx9NyarxjDiE1HGeWMHDv2MUTAq9nYzt'

    it('should derive the account from the named signer', async () => {
      wallet.addSigner('other', new SeedSignerSolana(OTHER_SEED_PHRASE))

      const account = await wallet.getAccount(0, { signerName: 'other' })

      expect(await account.getAddress()).toBe(OTHER_ACCOUNT_0_ADDRESS)
    })

    it('should cache accounts per signer', async () => {
      wallet.addSigner('other', new SeedSignerSolana(OTHER_SEED_PHRASE))

      const defaultAccount = await wallet.getAccount(0)
      const otherAccount = await wallet.getAccount(0, { signerName: 'other' })

      expect(otherAccount).not.toBe(defaultAccount)
      expect(await wallet.getAccount(0, { signerName: 'other' })).toBe(otherAccount)
    })

    it('should return the account of a named private-key signer without deriving', async () => {
      wallet.addSigner('treasury', new PrivateKeySignerSolana(PRIVATE_KEY))

      const account = await wallet.getAccount('treasury')

      expect(account.path).toBeNull()
      expect(await account.getAddress()).toBe(PRIVATE_KEY_ADDRESS)
      expect(await wallet.getAccount('treasury')).toBe(account)
    })

    it('should not wipe a registered signer on dispose', async () => {
      const signer = new PrivateKeySignerSolana(PRIVATE_KEY)
      wallet.addSigner('treasury', signer)
      await wallet.getAccount('treasury')

      wallet.dispose()

      expect(Buffer.from(signer.keyPair.privateKey).toString('hex')).toBe(PRIVATE_KEY)
    })

    it('should wipe the accounts it derived on dispose', async () => {
      const account = await wallet.getAccount(0)

      wallet.dispose()

      expect(account.keyPair.privateKey).toBeNull()
    })

    it('should throw if the named signer does not support account derivation', async () => {
      wallet.addSigner('treasury', new PrivateKeySignerSolana(PRIVATE_KEY))

      await expect(wallet.getAccountByPath("0'/0'", { signerName: 'treasury' }))
        .rejects.toThrow(new InvalidSignerError(UNSUPPORTED_DERIVATION_MESSAGE))
    })

    it('should throw if no signer is registered with the given name', async () => {
      await expect(wallet.getAccount(0, { signerName: 'missing' }))
        .rejects.toThrow('No signer found with name "missing".')
    })

    it('should derive the account at a custom path from the named signer', async () => {
      wallet.addSigner('other', new SeedSignerSolana(OTHER_SEED_PHRASE))

      const account = await wallet.getAccountByPath("1'/0'/0'", { signerName: 'other' })
      const defaultAccount = await wallet.getAccountByPath("1'/0'/0'")

      expect(account.path).toBe("m/44'/501'/1'/0'/0'")
      expect(await account.getAddress()).toBe(OTHER_PATH_100_ADDRESS)
      expect(await defaultAccount.getAddress()).toBe(PATH_100_ADDRESS)
    })

    it('should throw if no signer is registered with the given name (signer-name overload)', async () => {
      await expect(wallet.getAccount('missing'))
        .rejects.toThrow('No signer found with name "missing".')
    })
  })

  describe('getAccount', () => {
    it('should return account at index 0', async () => {
      const account = await wallet.getAccount(0)
      expect(account).toBeInstanceOf(WalletAccountSolana)
      expect(account.path).toBe(ACCOUNT_0.path)
    })

    it('should return the account at index 0 when no index is given', async () => {
      const account = await wallet.getAccount()

      expect(account.path).toBe(ACCOUNT_0.path)
      expect(await account.getAddress()).toBe(ACCOUNT_0.address)
    })

    it('should return different accounts for different indices', async () => {
      const account0 = await wallet.getAccount(0)
      const account1 = await wallet.getAccount(1)
      expect(account0).not.toBe(account1)
      expect(await account0.getAddress()).not.toBe(await account1.getAddress())
    })

    it('should handle large index numbers', async () => {
      const account = await wallet.getAccount(999)
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
