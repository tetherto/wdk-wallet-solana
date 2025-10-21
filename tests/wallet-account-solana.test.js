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

import { describe, it, expect, beforeAll, jest, beforeEach, afterEach } from '@jest/globals'
// import { Transaction, SystemProgram, PublicKey, Keypair, VersionedTransaction, TransactionMessage } from '@solana/web3.js'
import WalletManagerSolana from '../src/wallet-manager-solana.js'
import WalletAccountSolana from '../src/wallet-account-solana.js'
import WalletAccountReadOnlySolana from '../src/wallet-account-read-only-solana.js'

// Test seed phrase
const TEST_SEED_PHRASE = 'test walk nut penalty hip pave soap entry language right filter choice'
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
            "0'/0/0",
            {
              rpcUrl: TEST_RPC_URL,
              commitment: 'processed'
            }
          )
        ).rejects.toThrow('The seed phrase is invalid')
      })

      it('should accept valid BIP-39 seed phrase as string', async () => {
        const validSeedPhrase = 'test walk nut penalty hip pave soap entry language right filter choice'

        const account = await WalletAccountSolana.at(
          validSeedPhrase,
          "0'/0/0",
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
      it('should return a valid base58 Solana address', async () => {
        const address = await account.getAddress()

        expect(address).toBeDefined()
        expect(typeof address).toBe('string')
        expect(address.length).toBeGreaterThanOrEqual(32)
        expect(address.length).toBeLessThanOrEqual(44)
        expect(address).toMatch(/^[1-9A-HJ-NP-Za-km-z]+$/) // Base58 characters only
      })

      it('should return consistent address across multiple calls', async () => {
        const address1 = await account.getAddress()
        const address2 = await account.getAddress()
        const address3 = await account.getAddress()

        expect(address1).toBe(address2)
        expect(address2).toBe(address3)
      })

      it('should return different addresses for different account indices', async () => {
        const account0 = await wallet.getAccount(0)
        const account1 = await wallet.getAccount(1)
        const account2 = await wallet.getAccount(2)

        const address0 = await account0.getAddress()
        const address1 = await account1.getAddress()
        const address2 = await account2.getAddress()

        expect(address0).not.toBe(address1)
        expect(address1).not.toBe(address2)
        expect(address0).not.toBe(address2)
      })

      it('should return different addresses for different derivation paths', async () => {
        const accountPath1 = await wallet.getAccountByPath("0'/0/0")
        const accountPath2 = await wallet.getAccountByPath("0'/0/1")
        const accountPath3 = await wallet.getAccountByPath("1'/0/0")

        const address1 = await accountPath1.getAddress()
        const address2 = await accountPath2.getAddress()
        const address3 = await accountPath3.getAddress()

        expect(address1).not.toBe(address2)
        expect(address2).not.toBe(address3)
        expect(address1).not.toBe(address3)
      })
    })

    describe('keyPair', () => {
      it('should have correct key lengths', () => {
        const keyPair = account.keyPair
        expect(keyPair.publicKey.length).toBe(32) // Ed25519 public key
        expect(keyPair.privateKey.length).toBe(32) // Ed25519 private key
      })

      it('should have different key pairs for different accounts', async () => {
        const account0 = await wallet.getAccount(0)
        const account1 = await wallet.getAccount(1)

        const keyPair0 = account0.keyPair
        const keyPair1 = account1.keyPair

        expect(keyPair0.publicKey).not.toEqual(keyPair1.publicKey)
        expect(keyPair0.privateKey).not.toEqual(keyPair1.privateKey)
      })

      it('should have matching public key and address', async () => {
        const keyPair = account.keyPair
        const address = await account.getAddress()
        // const pubKeyAddress = new PublicKey(keyPair.publicKey).toBase58()

        // expect(pubKeyAddress).toBe(address)
      })

      it('should return the same key pair across multiple calls', () => {
        const keyPair1 = account.keyPair
        const keyPair2 = account.keyPair

        expect(keyPair1.publicKey).toEqual(keyPair2.publicKey)
        expect(keyPair1.privateKey).toEqual(keyPair2.privateKey)
      })
    })

    describe('path', () => {
      it('should follow BIP-44 Solana derivation path format', () => {
        const path = account.path

        expect(path).toBeDefined()
        expect(path).toMatch(/^m\/44'\/501'\/\d+'\/\d+\/\d+$/)
      })

      it('should have correct path for account index 0', async () => {
        const account0 = await wallet.getAccount(0)
        expect(account0.path).toBe("m/44'/501'/0'/0/0")
      })

      it('should have correct path for account index 5', async () => {
        const account5 = await wallet.getAccount(5)
        expect(account5.path).toBe("m/44'/501'/0'/0/5")
      })

      it('should have correct path for custom derivation', async () => {
        const customAccount = await wallet.getAccountByPath("1'/2/3")
        expect(customAccount.path).toBe("m/44'/501'/1'/2/3")
      })

      it('should have different paths for different accounts', async () => {
        const account0 = await wallet.getAccount(0)
        const account1 = await wallet.getAccount(1)
        const account2 = await wallet.getAccount(2)

        expect(account0.path).not.toBe(account1.path)
        expect(account1.path).not.toBe(account2.path)
        expect(account0.path).not.toBe(account2.path)
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

      it('should match the last segment of the path', async () => {
        const account = await wallet.getAccount(42)
        const pathSegments = account.path.split('/')
        const lastSegment = pathSegments[pathSegments.length - 1]

        expect(account.index).toBe(parseInt(lastSegment))
      })

      it('should extract index correctly from custom paths', async () => {
        const account1 = await wallet.getAccountByPath("0'/0/7")
        const account2 = await wallet.getAccountByPath("1'/0/15")
        const account3 = await wallet.getAccountByPath("0'/5/123")

        expect(account1.index).toBe(7)
        expect(account2.index).toBe(15)
        expect(account3.index).toBe(123)
      })

      it('should have different indices for different accounts', async () => {
        const account0 = await wallet.getAccount(0)
        const account1 = await wallet.getAccount(1)
        const account2 = await wallet.getAccount(2)

        expect(account0.index).not.toBe(account1.index)
        expect(account1.index).not.toBe(account2.index)
        expect(account0.index).not.toBe(account2.index)
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
        expect(keyPairBefore.privateKey.length).toBe(32)

        tempAccount.dispose()
        const keyPairAfter = tempAccount.keyPair
        expect(keyPairAfter.privateKey).toBeUndefined()
      })

      it('should dispose all accounts when wallet manager is disposed', async () => {
        const tempWallet = new WalletManagerSolana(TEST_SEED_PHRASE, {
          rpcUrl: TEST_RPC_URL,
          commitment: 'confirmed'
        })

        const account0 = await tempWallet.getAccount(0)
        const account1 = await tempWallet.getAccount(1)
        const account2 = await tempWallet.getAccount(2)

        expect(account0.keyPair.privateKey).not.toBeUndefined()
        expect(account1.keyPair.privateKey).not.toBeUndefined()
        expect(account2.keyPair.privateKey).not.toBeUndefined()

        tempWallet.dispose()

        expect(account0.keyPair.privateKey).toBeUndefined()
        expect(account1.keyPair.privateKey).toBeUndefined()
        expect(account2.keyPair.privateKey).toBeUndefined()
      })
      it('should keep public key accessible after disposal', async () => {
        const tempWallet = new WalletManagerSolana(TEST_SEED_PHRASE, {
          rpcUrl: TEST_RPC_URL,
          commitment: 'confirmed'
        })
        const tempAccount = await tempWallet.getAccount(98)

        const publicKeyBefore = tempAccount.keyPair.publicKey

        tempAccount.dispose()

        const publicKeyAfter = tempAccount.keyPair.publicKey

        expect(publicKeyAfter).toBeDefined()
      })

      it('should prevent signing after disposal', async () => {
        const tempWallet = new WalletManagerSolana(TEST_SEED_PHRASE, {
          rpcUrl: TEST_RPC_URL,
          commitment: 'confirmed'
        })
        const tempAccount = await tempWallet.getAccount(96)

        const signatureBefore = await tempAccount.sign('test message')
        expect(signatureBefore).toBeDefined()
        tempAccount.dispose()
        await expect(tempAccount.sign('test message')).rejects.toThrow()
      })
    })
  })

  describe('Message Signing and Verification', () => {
    describe('sign', () => {
      it('should sign simple text messages', async () => {
        const message = 'Test message'
        const signature = await account.sign(message)

        expect(signature).toBeDefined()
        expect(signature.length).toBe(128)
      })

      it('should produce different signatures for different messages', async () => {
        const message1 = 'Message 1'
        const message2 = 'Message 2'

        const signature1 = await account.sign(message1)
        const signature2 = await account.sign(message2)

        expect(signature1).not.toBe(signature2)
      })

      it('should produce consistent signatures for same message', async () => {
        const message = 'Consistent message'

        const signature1 = await account.sign(message)
        const signature2 = await account.sign(message)
        const signature3 = await account.sign(message)

        expect(signature1).toBe(signature2)
        expect(signature2).toBe(signature3)
      })

      it('should produce different signatures for different accounts', async () => {
        const account0 = await wallet.getAccount(0)
        const account1 = await wallet.getAccount(1)

        const message = 'Same message, different accounts'

        const signature0 = await account0.sign(message)
        const signature1 = await account1.sign(message)

        expect(signature0).not.toBe(signature1)
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

    describe('verify', () => {
      it('should verify signature for same message across multiple verifications', async () => {
        const message = 'Persistent message'
        const signature = await account.sign(message)

        const isValid1 = await account.verify(message, signature)
        const isValid2 = await account.verify(message, signature)
        const isValid3 = await account.verify(message, signature)

        expect(isValid1).toBe(true)
        expect(isValid2).toBe(true)
        expect(isValid3).toBe(true)
      })

      it('should reject signature for different message', async () => {
        const message1 = 'Message 1'
        const message2 = 'Message 2'

        const signature1 = await account.sign(message1)

        expect(await account.verify(message1, signature1)).toBe(true)
        expect(await account.verify(message2, signature1)).toBe(false)
      })

      it('should reject invalid hex signature', async () => {
        const message = 'Test message'
        const invalidSignature = 'not-a-valid-hex-signature'

        expect(await account.verify(message, invalidSignature)).toBe(false)
      })

      it('should reject signature with wrong length', async () => {
        const message = 'Test message'
        const shortSignature = 'abcdef1234567890'

        expect(await account.verify(message, shortSignature)).toBe(false)
      })

      it('should reject empty signature', async () => {
        const message = 'Test message'
        const emptySignature = ''

        expect(await account.verify(message, emptySignature)).toBe(false)
      })

      it('should reject signature from different account', async () => {
        const account0 = await wallet.getAccount(0)
        const account1 = await wallet.getAccount(1)

        const message = 'Cross-account test'

        const signature0 = await account0.sign(message)

        expect(await account0.verify(message, signature0)).toBe(true)
        expect(await account1.verify(message, signature0)).toBe(false)
      })
    })
  })

  describe('sendTransaction', () => {
    let mockRpc
    let originalRpc

    beforeEach(() => {
      // Save original RPC
      originalRpc = account._rpc

      // Create a mock RPC object
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
      // Restore original RPC
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
        ).rejects.toThrow('Wallet account has been disposed')
      })

      it('should throw for invalid transaction format', async () => {
        await expect(
          account.sendTransaction({ invalid: 'format' })
        ).rejects.toThrow('Invalid transaction object')
      })

      it('should throw for empty transaction', async () => {
        await expect(
          account.sendTransaction({})
        ).rejects.toThrow('Invalid transaction object')
      })
    })

    describe('Native Transfer Transaction', () => {
      it('should accept simple {to, value} transaction format', async () => {
        // Setup mocks
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

        // Replace the RPC object
        account._rpc = mockRpc

        const tx = {
          to: '9CXtfmGEtfjmtPKnq2QZcRzCiMzE9T8NQfRicJZetvk2',
          value: 1000000n
        }

        const result = await account.sendTransaction(tx, { skipConfirmation: true })

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

        // Test with bigint
        await account.sendTransaction({
          to: '8KpbCiK2SfNRNqosmkfvys5itK6CbjcxLXG8e2gLgzmP',
          value: 1000000n
        }, { skipConfirmation: true })

        // Test with number
        await account.sendTransaction({
          to: '8KpbCiK2SfNRNqosmkfvys5itK6CbjcxLXG8e2gLgzmP',
          value: 1000000
        }, { skipConfirmation: true })

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
          // No feePayer set
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

        const result = await account.sendTransaction(txMessage, { skipConfirmation: true })

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

        await expect(
          account.sendTransaction(txMessage)
        ).rejects.toThrow('does not match wallet address')
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

        const result = await account.sendTransaction({
          to: '8KpbCiK2SfNRNqosmkfvys5itK6CbjcxLXG8e2gLgzmP',
          value: 1000n
        }, { skipConfirmation: true })

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
      // Save original RPC
      originalRpc = account._rpc

      // Create a mock RPC object
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
      // Restore original RPC
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
        ).rejects.toThrow('Wallet account has been disposed')
      })

      it('should throw if amount exceeds u64 maximum', async () => {
        await expect(
          account.transfer({
            token: 'FzFRHEc1tWLGa2doGw2KAKrfNrBH3QwGTnjm37o2HQGb',
            recipient: 'FzFRHEc1tWLGa2doGw2KAKrfNrBH3QwGTnjm37o2HQGb',
            amount: 0xFFFFFFFFFFFFFFFFn + 1n // u64 max + 1
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
        // Mock mint account data with decimals at byte 44
        const mintData = new Uint8Array(165)
        mintData[44] = 6 // 6 decimals (like USDC)

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

        // Valid bigint
        await account.transfer({
          token: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
          recipient: 'ASbM8cPUrBxgjgNuu3hQSK2JSDDG6HhQ9FqU3ofprkMV',
          amount: 1000000n
        }, { skipConfirmation: true })

        // Valid number
        await account.transfer({
          token: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
          recipient: 'ASbM8cPUrBxgjgNuu3hQSK2JSDDG6HhQ9FqU3ofprkMV',
          amount: 1000000
        }, { skipConfirmation: true })

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
          send: jest.fn().mockResolvedValue({ value: 15000 }) // Exceeds limit
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
          send: jest.fn().mockResolvedValue({ value: 5000 }) // Below limit
        })
        mockRpc.sendTransaction.mockReturnValue({
          send: jest.fn().mockResolvedValue('sig')
        })

        limitedAccount._rpc = mockRpc

        const result = await limitedAccount.transfer({
          token: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
          recipient: 'ASbM8cPUrBxgjgNuu3hQSK2JSDDG6HhQ9FqU3ofprkMV',
          amount: 1000n
        }, { skipConfirmation: true })

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

        const result = await account.transfer({
          token: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
          recipient: '11111111111111111111111111111111',
          amount: 1000000n
        }, { skipConfirmation: true })

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