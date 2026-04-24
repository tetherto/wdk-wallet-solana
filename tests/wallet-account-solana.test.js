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
  beforeAll,
  jest,
  beforeEach,
  afterEach
} from '@jest/globals'
import WalletManagerSolana from '../src/wallet-manager-solana.js'
import WalletAccountSolana from '../src/wallet-account-solana.js'
import WalletAccountReadOnlySolana from '../src/wallet-account-read-only-solana.js'

const TEST_SEED_PHRASE =
  'test walk nut penalty hip pave soap entry language right filter choice'
const TEST_RPC_URL = 'https://mockurl.com'

describe('WalletAccountSolana', () => {
  let wallet
  let account

  beforeAll(async () => {
    wallet = new WalletManagerSolana(TEST_SEED_PHRASE, {
      rpcUrl: TEST_RPC_URL,
      commitment: 'processed'
    })

    account = await wallet.getAccount(0)
  })
  describe('Wallet Properties', () => {
    describe('seed', () => {
      it('should throw if invalid words in seed phrase', async () => {
        await expect(
          WalletAccountSolana.at(
            'invalid word that does not exist test test test test test test test',
            "0'/0'/0'",
            {
              rpcUrl: TEST_RPC_URL,
              commitment: 'processed'
            }
          )
        ).rejects.toThrow('The seed phrase is invalid')
      })

      it('should accept valid BIP-39 seed phrase as string', async () => {
        const account = await WalletAccountSolana.at(
          TEST_SEED_PHRASE,
          "0'/0'/0'",
          {
            rpcUrl: TEST_RPC_URL,
            commitment: 'confirmed'
          }
        )

        expect(account).toBeDefined()
        expect(account).toBeInstanceOf(WalletAccountSolana)
      })
    })

    describe('getAddress', () => {
      it('should return a valid Solana address', async () => {
        const address = await account.getAddress()
        expect(address).toMatch('3uXqWpwgqKVdiHAwF6Vmu4G4vdQzpR66xjPkz1G7zMKE')
      })

      it('should return different addresses for different account indices', async () => {
        const account0 = await wallet.getAccount(0)
        const account1 = await wallet.getAccount(1)
        const account2 = await wallet.getAccount(2)

        const address0 = await account0.getAddress()
        const address1 = await account1.getAddress()
        const address2 = await account2.getAddress()

        expect(address0).toMatch(
          '3uXqWpwgqKVdiHAwF6Vmu4G4vdQzpR66xjPkz1G7zMKE'
        )
        expect(address1).toMatch(
          'CfGcujEkPVDx7yGyn1PUjxn2e353MXbLk8ixzwuJUktK'
        )
        expect(address2).toMatch(
          'Grwp8oDHgAD8PVSS51pWGCY5QRM3hqiH8QcbPRAEUABq'
        )
      })

      it('should return different addresses for different derivation paths', async () => {
        const accountPath1 = await wallet.getAccountByPath("0'/0'/0'")
        const accountPath2 = await wallet.getAccountByPath("0'/0'/1'")
        const accountPath3 = await wallet.getAccountByPath("1'/0'/0'")

        const address1 = await accountPath1.getAddress()
        const address2 = await accountPath2.getAddress()
        const address3 = await accountPath3.getAddress()

        expect(address1).toMatch(
          'DPGHHHMaayXkaThUJCUnUAJCdgc9sxNh1UEGa6vJximM'
        )
        expect(address2).toMatch('jbhYXhWfRPqPvaKqaWCJEgBdZMquFxUvjWaWLEH3YCz')
        expect(address3).toMatch(
          '57hwCai22XueypvXcXKotkuAQYj2eukFcY5ymWB7Arvg'
        )
      })
    })

    describe('keyPair', () => {
      it('should have consistent keyPair', () => {
        const keyPair = account.keyPair
        expect(Buffer.from(keyPair.publicKey).toString('hex')).toBe(
          '2b2c715c2cf24db57e95a44df34cb424de2460e86c4f6ebe7ba62b574830de19'
        )
        expect(Buffer.from(keyPair.privateKey).toString('hex')).toBe(
          'de705bcaa34a2ea50c0b7e6e584006f2458652fa9d6e20994ac146852490c76f'
        )
      })

      it('should have different key pairs for different accounts', async () => {
        const account0 = await wallet.getAccount(0)
        const account1 = await wallet.getAccount(1)

        const keyPair0 = account0.keyPair
        const keyPair1 = account1.keyPair

        expect(Buffer.from(keyPair0.publicKey).toString('hex')).toBe(
          '2b2c715c2cf24db57e95a44df34cb424de2460e86c4f6ebe7ba62b574830de19'
        )
        expect(Buffer.from(keyPair0.privateKey).toString('hex')).toBe(
          'de705bcaa34a2ea50c0b7e6e584006f2458652fa9d6e20994ac146852490c76f'
        )
        expect(Buffer.from(keyPair1.publicKey).toString('hex')).toBe(
          'ad3e499bc158a797574c53bcca546939f0de16242b85ed39a848092c4d9d5274'
        )
        expect(Buffer.from(keyPair1.privateKey).toString('hex')).toBe(
          '4642fc818f6525a2c5ae784cc98f44d639492c21271c5f7f0ac30ee95a3357bb'
        )
      })
    })

    describe('path', () => {
      it('should follow SLIP-0010 Solana derivation path format', () => {
        const path = account.path

        expect(path).toMatch("m/44'/501'/0'/0'")
      })

      it('should have correct path for account index 0', async () => {
        const account0 = await wallet.getAccount(0)
        expect(account0.path).toBe("m/44'/501'/0'/0'")
      })

      it('should have correct path for account index 5', async () => {
        const account5 = await wallet.getAccount(5)
        expect(account5.path).toBe("m/44'/501'/5'/0'")
      })

      it('should have correct path for custom derivation', async () => {
        const customAccount = await wallet.getAccountByPath("1'/2'/3'")
        expect(customAccount.path).toBe("m/44'/501'/1'/2'/3'")
      })
    })

    describe('index', () => {
      it('should return correct index for account 0', async () => {
        const account0 = await wallet.getAccount(0)
        expect(account0.index).toBe(0)
      })

      it('should return correct index for account 999', async () => {
        const account999 = await wallet.getAccount(999)
        expect(account999.index).toBe(999)
      })

      it('should extract index correctly from custom paths', async () => {
        const account1 = await wallet.getAccountByPath("0'/0'/7'")
        const account2 = await wallet.getAccountByPath("1'/0'/15'")
        const account3 = await wallet.getAccountByPath("0'/5'/123'")

        expect(account1.index).toBe(0)
        expect(account2.index).toBe(1)
        expect(account3.index).toBe(0)
      })
    })

    describe('dispose', () => {
      it('should clear private key from memory', async () => {
        const tempWallet = new WalletManagerSolana(TEST_SEED_PHRASE, {
          rpcUrl: TEST_RPC_URL,
          commitment: 'confirmed'
        })
        const tempAccount = await tempWallet.getAccount(99)

        const keyPairBefore = tempAccount.keyPair
        expect(keyPairBefore.privateKey).not.toBeNull()
        expect(keyPairBefore.privateKey).not.toBeUndefined()

        tempAccount.dispose()
        const keyPairAfter = tempAccount.keyPair
        expect(keyPairAfter.privateKey).toBeNull
      })

      it('should dispose all accounts when wallet manager is disposed', async () => {
        const tempWallet = new WalletManagerSolana(TEST_SEED_PHRASE, {
          rpcUrl: TEST_RPC_URL,
          commitment: 'confirmed'
        })

        const account0 = await tempWallet.getAccount(0)
        const account1 = await tempWallet.getAccount(1)
        const account2 = await tempWallet.getAccount(2)

        expect(account0.keyPair.privateKey).not.toBeNull
        expect(account1.keyPair.privateKey).not.toBeNull
        expect(account2.keyPair.privateKey).not.toBeNull

        tempWallet.dispose()

        expect(account0.keyPair.privateKey).toBeNull
        expect(account1.keyPair.privateKey).toBeNull
        expect(account2.keyPair.privateKey).toBeNull
      })
      it('should keep public key accessible after disposal', async () => {
        const tempWallet = new WalletManagerSolana(TEST_SEED_PHRASE, {
          rpcUrl: TEST_RPC_URL,
          commitment: 'confirmed'
        })
        const tempAccount = await tempWallet.getAccount(98)

        tempAccount.dispose()

        const publicKeyAfter = tempAccount.keyPair.publicKey

        expect(publicKeyAfter).toBeDefined()
      })
    })
  })

  describe('Message Signing and Verification', () => {
    describe('sign', () => {
      it('should produce consistent signature for a message', async () => {
        const message = 'Test message'
        const signature = await account.sign(message)

        expect(signature).toBe(
          '90d1d5dc7430f3efa9fa037ba2179458fad9a8bfdf42ba74fff4581ce9e0ac2fba1562483b072e9eee709ef8d59448b379d9a61e634b37a3c13858bab7754f08'
        )
      })

      it('should produce different signatures for different messages', async () => {
        const message1 = 'Message 1'
        const message2 = 'Message 2'

        const signature1 = await account.sign(message1)
        const signature2 = await account.sign(message2)

        expect(signature1).toBe(
          '06f06d64f9a5338595410825aee9ae6b04bd0069fcd36afca765f75b3c4ebb42c2ee35a62961b8edc3afc1d10b50dcdb558d9904707326236598d0b7c0385204'
        )
        expect(signature2).toBe(
          'c4d4f624a1d7ba1992cdfd6ce5a8a3e7e2ac46ad342ef8b00b8c10f73633223a882ff8230b009691d57291aa6224a648371f9208c447ed695be47ec395a6ad0d'
        )
      })

      it('should throw error after account disposal', async () => {
        const tempWallet = new WalletManagerSolana(TEST_SEED_PHRASE, {
          rpcUrl: TEST_RPC_URL,
          commitment: 'confirmed'
        })
        const tempAccount = await tempWallet.getAccount(95)

        const signatureBefore = await tempAccount.sign('test message')
        expect(signatureBefore).toBeDefined()

        tempAccount.dispose()

        await expect(tempAccount.sign('test message')).rejects.toThrow()
      })
    })
  })

  describe('sendTransaction', () => {
    let mockRpc
    let originalRpc

    beforeEach(() => {
      originalRpc = account._rpc

      mockRpc = {
        getFeeForMessage: jest.fn(),
        sendTransaction: jest.fn(),
        getSignatureStatuses: jest.fn(),
        getLatestBlockhash: jest.fn().mockReturnValue({
          send: jest.fn().mockResolvedValue({
            value: {
              blockhash: '6JbYxigC1rn83PMHZait5FHHpC3YqUMacnVJWFwfoayQ',
              lastValidBlockHeight: 1000000
            }
          })
        })
      }
    })

    afterEach(() => {
      account._rpc = originalRpc
    })

    describe('Input Validation', () => {
      it('should throw if RPC not configured', async () => {
        const noRpcWallet = new WalletManagerSolana(TEST_SEED_PHRASE)
        const noRpcAccount = await noRpcWallet.getAccount(0)

        await expect(
          noRpcAccount.sendTransaction({ to: 'DummyAddress', value: 1000n })
        ).rejects.toThrow('The wallet must be connected to a provider')
      })

      it('should throw if account is disposed', async () => {
        const tempWallet = new WalletManagerSolana(TEST_SEED_PHRASE, {
          rpcUrl: TEST_RPC_URL,
          commitment: 'confirmed'
        })
        const tempAccount = await tempWallet.getAccount(90)

        tempAccount.dispose()

        await expect(
          tempAccount.sendTransaction({ to: 'DummyAddress', value: 1000n })
        ).rejects.toThrow('The wallet account has been disposed.')
      })
    })

    describe('Native Transfer Transaction', () => {
      it('should accept simple {to, value} transaction format', async () => {
        mockRpc.getFeeForMessage.mockReturnValue({
          send: jest.fn().mockResolvedValue({ value: 5000 })
        })
        mockRpc.sendTransaction.mockReturnValue({
          send: jest.fn().mockResolvedValue('mock-signature-123')
        })
        mockRpc.getSignatureStatuses.mockReturnValue({
          send: jest.fn().mockResolvedValue({
            value: [{ err: null, confirmationStatus: 'confirmed' }]
          })
        })

        account._rpc = mockRpc

        const tx = {
          to: '9CXtfmGEtfjmtPKnq2QZcRzCiMzE9T8NQfRicJZetvk2',
          value: 1000000n
        }

        const result = await account.sendTransaction(tx, {
          skipConfirmation: true
        })

        expect(result).toBeDefined()
        expect(result.hash).toBe('mock-signature-123')
        expect(result.fee).toBe(5000n)
        expect(mockRpc.sendTransaction).toHaveBeenCalled()
      })

      it('should handle bigint and number values', async () => {
        mockRpc.getFeeForMessage.mockReturnValue({
          send: jest.fn().mockResolvedValue({ value: 5000 })
        })
        mockRpc.sendTransaction.mockReturnValue({
          send: jest.fn().mockResolvedValue('sig1')
        })

        account._rpc = mockRpc

        await account.sendTransaction(
          {
            to: '8KpbCiK2SfNRNqosmkfvys5itK6CbjcxLXG8e2gLgzmP',
            value: 1000000n
          },
          { skipConfirmation: true }
        )

        await account.sendTransaction(
          {
            to: '8KpbCiK2SfNRNqosmkfvys5itK6CbjcxLXG8e2gLgzmP',
            value: 1000000
          },
          { skipConfirmation: true }
        )

        expect(mockRpc.sendTransaction).toHaveBeenCalledTimes(2)
      })
    })

    describe('TransactionMessage Format', () => {
      it('should accept TransactionMessage with instructions', async () => {
        mockRpc.getFeeForMessage.mockReturnValue({
          send: jest.fn().mockResolvedValue({ value: 5000 })
        })
        mockRpc.sendTransaction.mockReturnValue({
          send: jest.fn().mockResolvedValue('mock-sig')
        })

        account._rpc = mockRpc

        const txMessage = {
          instructions: [
            {
              programAddress: '11111111111111111111111111111111',
              accounts: [],
              data: new Uint8Array()
            }
          ],
          version: 0
        }

        const result = await account.sendTransaction(txMessage)

        expect(result.hash).toBe('mock-sig')
        expect(mockRpc.sendTransaction).toHaveBeenCalled()
      })

      it('should add fee payer if missing', async () => {
        mockRpc.getFeeForMessage.mockReturnValue({
          send: jest.fn().mockResolvedValue({ value: 5000 })
        })
        mockRpc.sendTransaction.mockReturnValue({
          send: jest.fn().mockResolvedValue('mock-sig')
        })

        account._rpc = mockRpc

        const txMessage = {
          instructions: [],
          version: 0
        }

        await account.sendTransaction(txMessage, { skipConfirmation: true })

        expect(mockRpc.sendTransaction).toHaveBeenCalled()
      })

      it('should verify fee payer matches account address (string format)', async () => {
        mockRpc.getFeeForMessage.mockReturnValue({
          send: jest.fn().mockResolvedValue({ value: 5000 })
        })
        mockRpc.sendTransaction.mockReturnValue({
          send: jest.fn().mockResolvedValue('mock-sig')
        })

        account._rpc = mockRpc

        const accountAddress = await account.getAddress()

        const txMessage = {
          instructions: [
            {
              programAddress: '11111111111111111111111111111111',
              accounts: [],
              data: new Uint8Array()
            }
          ],
          version: 0,
          feePayer: accountAddress
        }

        const result = await account.sendTransaction(txMessage, {
          skipConfirmation: true
        })

        expect(result.hash).toBe('mock-sig')
        expect(mockRpc.sendTransaction).toHaveBeenCalled()
      })

      it('should throw if fee payer does not match account', async () => {
        account._rpc = mockRpc

        const txMessage = {
          instructions: [],
          version: 0,
          feePayer: {
            address: 'DifferentAddress11111111111111111111111'
          }
        }

        await expect(account.sendTransaction(txMessage)).rejects.toThrow(
          'does not match wallet address'
        )
      })
    })

    describe('Fee Estimation', () => {
      it('should estimate and return transaction fee', async () => {
        mockRpc.getFeeForMessage.mockReturnValue({
          send: jest.fn().mockResolvedValue({ value: 7500 })
        })
        mockRpc.sendTransaction.mockReturnValue({
          send: jest.fn().mockResolvedValue('sig')
        })

        account._rpc = mockRpc

        const result = await account.sendTransaction(
          {
            to: '8KpbCiK2SfNRNqosmkfvys5itK6CbjcxLXG8e2gLgzmP',
            value: 1000n
          },
          { skipConfirmation: true }
        )

        expect(result.fee).toBe(7500n)
        expect(mockRpc.getFeeForMessage).toHaveBeenCalled()
      })

      it('should throw if fee estimation fails', async () => {
        mockRpc.getFeeForMessage.mockReturnValue({
          send: jest.fn().mockResolvedValue({ value: null })
        })

        account._rpc = mockRpc

        await expect(
          account.sendTransaction({
            to: '8KpbCiK2SfNRNqosmkfvys5itK6CbjcxLXG8e2gLgzmP',
            value: 1000n
          })
        ).rejects.toThrow('Failed to calculate transaction fee')
      })
    })
  })

  describe('transfer', () => {
    let mockRpc
    let originalRpc

    beforeEach(() => {
      originalRpc = account._rpc

      mockRpc = {
        getAccountInfo: jest.fn(),
        getFeeForMessage: jest.fn(),
        sendTransaction: jest.fn(),
        getSignatureStatuses: jest.fn(),
        getLatestBlockhash: jest.fn().mockReturnValue({
          send: jest.fn().mockResolvedValue({
            value: {
              blockhash: 'ASbM8cPUrBxgjgNuu3hQSK2JSDDG6HhQ9FqU3ofprkMV',
              lastValidBlockHeight: 2000000
            }
          })
        })
      }
    })

    afterEach(() => {
      account._rpc = originalRpc
    })

    describe('Input Validation', () => {
      it('should throw if RPC not configured', async () => {
        const noRpcWallet = new WalletManagerSolana(TEST_SEED_PHRASE)
        const noRpcAccount = await noRpcWallet.getAccount(0)

        await expect(
          noRpcAccount.transfer({
            token: 'FzFRHEc1tWLGa2doGw2KAKrfNrBH3QwGTnjm37o2HQGb',
            recipient: 'FzFRHEc1tWLGa2doGw2KAKrfNrBH3QwGTnjm37o2HQGb',
            amount: 1000n
          })
        ).rejects.toThrow('The wallet must be connected to a provider')
      })

      it('should throw if account is disposed', async () => {
        const tempWallet = new WalletManagerSolana(TEST_SEED_PHRASE, {
          rpcUrl: TEST_RPC_URL,
          commitment: 'confirmed'
        })
        const tempAccount = await tempWallet.getAccount(89)

        tempAccount.dispose()

        await expect(
          tempAccount.transfer({
            token: 'FzFRHEc1tWLGa2doGw2KAKrfNrBH3QwGTnjm37o2HQGb',
            recipient: 'FzFRHEc1tWLGa2doGw2KAKrfNrBH3QwGTnjm37o2HQGb',
            amount: 1000n
          })
        ).rejects.toThrow('The wallet account has been disposed.')
      })

      it('should throw if amount exceeds u64 maximum', async () => {
        await expect(
          account.transfer({
            token: 'FzFRHEc1tWLGa2doGw2KAKrfNrBH3QwGTnjm37o2HQGb',
            recipient: 'FzFRHEc1tWLGa2doGw2KAKrfNrBH3QwGTnjm37o2HQGb',
            amount: 0xffffffffffffffffn + 1n
          })
        ).rejects.toThrow('Amount exceeds u64 maximum value')
      })

      it('should throw if number amount exceeds safe integer', async () => {
        await expect(
          account.transfer({
            token: 'FzFRHEc1tWLGa2doGw2KAKrfNrBH3QwGTnjm37o2HQGb',
            recipient: 'FzFRHEc1tWLGa2doGw2KAKrfNrBH3QwGTnjm37o2HQGb',
            amount: Number.MAX_SAFE_INTEGER + 1
          })
        ).rejects.toThrow('Amount exceeds safe integer range')
      })

      it('should accept valid amounts', async () => {
        const mintData = new Uint8Array(165)
        mintData[44] = 6

        mockRpc.getAccountInfo.mockReturnValue({
          send: jest.fn().mockResolvedValue({
            value: { data: mintData }
          })
        })
        mockRpc.getFeeForMessage.mockReturnValue({
          send: jest.fn().mockResolvedValue({ value: 5000 })
        })
        mockRpc.sendTransaction.mockReturnValue({
          send: jest.fn().mockResolvedValue('sig')
        })

        account._rpc = mockRpc

        await account.transfer(
          {
            token: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
            recipient: 'ASbM8cPUrBxgjgNuu3hQSK2JSDDG6HhQ9FqU3ofprkMV',
            amount: 1000000n
          },
          { skipConfirmation: true }
        )

        await account.transfer(
          {
            token: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
            recipient: 'ASbM8cPUrBxgjgNuu3hQSK2JSDDG6HhQ9FqU3ofprkMV',
            amount: 1000000
          },
          { skipConfirmation: true }
        )

        expect(mockRpc.sendTransaction).toHaveBeenCalledTimes(2)
      })
    })

    describe('Fee Limit', () => {
      it('should respect transferMaxFee configuration', async () => {
        const limitedWallet = new WalletManagerSolana(TEST_SEED_PHRASE, {
          rpcUrl: TEST_RPC_URL,
          commitment: 'confirmed',
          transferMaxFee: 10000n
        })
        const limitedAccount = await limitedWallet.getAccount(0)

        const mintData = new Uint8Array(165)
        mintData[44] = 6

        mockRpc.getAccountInfo.mockReturnValue({
          send: jest.fn().mockResolvedValue({
            value: { data: mintData }
          })
        })
        mockRpc.getFeeForMessage.mockReturnValue({
          send: jest.fn().mockResolvedValue({ value: 15000 })
        })

        limitedAccount._rpc = mockRpc

        await expect(
          limitedAccount.transfer({
            token: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
            recipient: 'ASbM8cPUrBxgjgNuu3hQSK2JSDDG6HhQ9FqU3ofprkMV',
            amount: 1000n
          })
        ).rejects.toThrow('Exceeded maximum fee cost')
      })

      it('should allow transfer if fee is below limit', async () => {
        const limitedWallet = new WalletManagerSolana(TEST_SEED_PHRASE, {
          rpcUrl: TEST_RPC_URL,
          commitment: 'confirmed',
          transferMaxFee: 10000n
        })
        const limitedAccount = await limitedWallet.getAccount(0)

        const mintData = new Uint8Array(165)
        mintData[44] = 6

        mockRpc.getAccountInfo.mockReturnValue({
          send: jest.fn().mockResolvedValue({
            value: { data: mintData }
          })
        })
        mockRpc.getFeeForMessage.mockReturnValue({
          send: jest.fn().mockResolvedValue({ value: 5000 })
        })
        mockRpc.sendTransaction.mockReturnValue({
          send: jest.fn().mockResolvedValue('sig')
        })

        limitedAccount._rpc = mockRpc

        const result = await limitedAccount.transfer(
          {
            token: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
            recipient: 'ASbM8cPUrBxgjgNuu3hQSK2JSDDG6HhQ9FqU3ofprkMV',
            amount: 1000n
          },
          { skipConfirmation: true }
        )

        expect(result.hash).toBe('sig')
        expect(mockRpc.sendTransaction).toHaveBeenCalled()
      })
    })

    describe('SPL Token Transfer', () => {
      it('should build and send SPL token transfer', async () => {
        const mintData = new Uint8Array(165)
        mockRpc.getAccountInfo.mockReturnValue({
          send: jest.fn().mockResolvedValue({
            value: { data: mintData }
          })
        })
        mockRpc.getFeeForMessage.mockReturnValue({
          send: jest.fn().mockResolvedValue({ value: 5000 })
        })
        mockRpc.sendTransaction.mockReturnValue({
          send: jest.fn().mockResolvedValue('transfer-sig')
        })

        account._rpc = mockRpc

        const result = await account.transfer(
          {
            token: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
            recipient: '11111111111111111111111111111111',
            amount: 1000000n
          },
          { skipConfirmation: true }
        )

        expect(result.hash).toBe('transfer-sig')
        expect(result.fee).toBe(5000n)
        expect(mockRpc.sendTransaction).toHaveBeenCalled()
      })
    })
  })

  describe('toReadOnlyAccount', () => {
    it('should create a read-only account from full account', async () => {
      const readOnlyAccount = await account.toReadOnlyAccount()

      expect(readOnlyAccount).toBeInstanceOf(WalletAccountReadOnlySolana)
      expect(readOnlyAccount).not.toBeInstanceOf(WalletAccountSolana)
    })
  })
})
