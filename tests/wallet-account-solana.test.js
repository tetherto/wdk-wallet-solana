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
import { Transaction, SystemProgram, PublicKey, Keypair, VersionedTransaction, TransactionMessage } from '@solana/web3.js'
import WalletManagerSolana from '../src/wallet-manager-solana.js'
import WalletAccountSolana from '../src/wallet-account-solana.js'

// Test seed phrase
const TEST_SEED_PHRASE = 'test walk nut penalty hip pave soap entry language right filter choice'

// Solana Devnet RPC endpoint
const TEST_RPC_URL = 'https://api.devnet.solana.com'

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
        expect(keyPair.privateKey.length).toBe(64) // Ed25519 private key
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
        const pubKeyAddress = new PublicKey(keyPair.publicKey).toBase58()

        expect(pubKeyAddress).toBe(address)
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

      it('should return correct index for account 10', async () => {
        const account10 = await wallet.getAccount(10)
        expect(account10.index).toBe(10)
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
        expect(keyPairBefore.privateKey.length).toBe(64)

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

        expect(publicKeyAfter).toEqual(publicKeyBefore)
        expect(publicKeyAfter.length).toBe(32)
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

  describe('sendTransaction', () => {
    let originalGetLatestBlockhash
    let originalGetFeeForMessage

    beforeEach(() => {
      // Store original methods
      originalGetLatestBlockhash = account._connection.getLatestBlockhash
      originalGetFeeForMessage = account._connection.getFeeForMessage

      // Mock connection methods with valid base58 blockhash
      account._connection.getLatestBlockhash = jest.fn().mockResolvedValue({
        blockhash: 'HhqkdqemrKDK5Wd4oiCtzfpBWfdGS79YhLtzAck5Nz7T',
        lastValidBlockHeight: 100000
      })

      account._connection.getFeeForMessage = jest.fn().mockResolvedValue({
        value: 5000
      })
    })

    afterEach(() => {
      // Restore original methods
      account._connection.getLatestBlockhash = originalGetLatestBlockhash
      account._connection.getFeeForMessage = originalGetFeeForMessage
    })

    describe('Legacy Transaction', () => {
      it('should send a legacy transaction successfully', async () => {
        const recipient = Keypair.generate().publicKey
        const senderAddress = await account.getAddress()
        const senderPublicKey = new PublicKey(senderAddress)

        const tx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: senderPublicKey,
            toPubkey: recipient,
            lamports: 1000
          })
        )

        const mockSignature = '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW'

        account._connection.sendRawTransaction = jest.fn().mockResolvedValue(mockSignature)
        account._connection.confirmTransaction = jest.fn().mockResolvedValue({
          value: { err: null }
        })

        const result = await account.sendTransaction(tx)

        expect(result).toBeDefined()
        expect(result.hash).toBe(mockSignature)
        expect(result.fee).toBe(5000n)
        expect(typeof result.hash).toBe('string')
        expect(typeof result.fee).toBe('bigint')

        expect(account._connection.getLatestBlockhash).toHaveBeenCalled()
        expect(account._connection.getFeeForMessage).toHaveBeenCalled()
        expect(account._connection.sendRawTransaction).toHaveBeenCalled()
      })

      it('should add blockhash if not provided', async () => {
        const recipient = Keypair.generate().publicKey
        const senderAddress = await account.getAddress()
        const senderPublicKey = new PublicKey(senderAddress)

        const tx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: senderPublicKey,
            toPubkey: recipient,
            lamports: 1000
          })
        )

        const mockSignature = '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW'
        account._connection.sendRawTransaction = jest.fn().mockResolvedValue(mockSignature)
        account._connection.confirmTransaction = jest.fn().mockResolvedValue({ value: { err: null } })

        expect(tx.recentBlockhash).toBeUndefined()
        await account.sendTransaction(tx)

        expect(account._connection.getLatestBlockhash).toHaveBeenCalled()
        expect(tx.recentBlockhash).toBe('HhqkdqemrKDK5Wd4oiCtzfpBWfdGS79YhLtzAck5Nz7T')
      })

      it('should keep existing blockhash if already provided', async () => {
        const recipient = Keypair.generate().publicKey
        const senderAddress = await account.getAddress()
        const senderPublicKey = new PublicKey(senderAddress)

        const existingBlockhash = 'BeDm4uW8qH1utEAcWErfWmc4YvnJjJtnQ49pgVthm1GM'
        const tx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: senderPublicKey,
            toPubkey: recipient,
            lamports: 1000
          })
        )
        tx.recentBlockhash = existingBlockhash

        const mockSignature = '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW'
        account._connection.sendRawTransaction = jest.fn().mockResolvedValue(mockSignature)
        account._connection.confirmTransaction = jest.fn().mockResolvedValue({ value: { err: null } })

        await account.sendTransaction(tx)

        expect(tx.recentBlockhash).toBe(existingBlockhash)
      })

      it('should set fee payer if not provided', async () => {
        const recipient = Keypair.generate().publicKey
        const senderAddress = await account.getAddress()
        const senderPublicKey = new PublicKey(senderAddress)

        const tx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: senderPublicKey,
            toPubkey: recipient,
            lamports: 1000
          })
        )

        const mockSignature = '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW'
        account._connection.sendRawTransaction = jest.fn().mockResolvedValue(mockSignature)
        account._connection.confirmTransaction = jest.fn().mockResolvedValue({ value: { err: null } })

        expect(tx.feePayer).toBeUndefined()

        await account.sendTransaction(tx)

        expect(tx.feePayer).toEqual(senderPublicKey)
      })

      it('should validate fee payer matches wallet address', async () => {
        const recipient = Keypair.generate().publicKey
        const wrongFeePayer = Keypair.generate().publicKey

        const tx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: wrongFeePayer,
            toPubkey: recipient,
            lamports: 1000
          })
        )
        tx.feePayer = wrongFeePayer

        await expect(account.sendTransaction(tx)).rejects.toThrow('Transaction fee payer must match wallet address')
      })

      it('should sign transaction if not already signed', async () => {
        const recipient = Keypair.generate().publicKey
        const senderAddress = await account.getAddress()
        const senderPublicKey = new PublicKey(senderAddress)

        const tx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: senderPublicKey,
            toPubkey: recipient,
            lamports: 1000
          })
        )

        const mockSignature = '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW'
        account._connection.sendRawTransaction = jest.fn().mockResolvedValue(mockSignature)
        account._connection.confirmTransaction = jest.fn().mockResolvedValue({ value: { err: null } })

        expect(tx.signatures.length).toBe(0)

        await account.sendTransaction(tx)

        expect(tx.signatures.length).toBeGreaterThan(0)
        expect(tx.signatures[0].signature).not.toBeNull()
      })

      it('should handle transaction with multiple instructions', async () => {
        const recipient1 = Keypair.generate().publicKey
        const recipient2 = Keypair.generate().publicKey
        const senderAddress = await account.getAddress()
        const senderPublicKey = new PublicKey(senderAddress)

        const tx = new Transaction()
          .add(
            SystemProgram.transfer({
              fromPubkey: senderPublicKey,
              toPubkey: recipient1,
              lamports: 1000
            })
          )
          .add(
            SystemProgram.transfer({
              fromPubkey: senderPublicKey,
              toPubkey: recipient2,
              lamports: 2000
            })
          )

        const mockSignature = '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW'
        account._connection.sendRawTransaction = jest.fn().mockResolvedValue(mockSignature)
        account._connection.confirmTransaction = jest.fn().mockResolvedValue({ value: { err: null } })

        const result = await account.sendTransaction(tx)

        expect(result.hash).toBe(mockSignature)
        expect(tx.instructions.length).toBe(2)
      })

      it('should throw error when getLatestBlockhash fails', async () => {
        const recipient = Keypair.generate().publicKey
        const senderAddress = await account.getAddress()
        const senderPublicKey = new PublicKey(senderAddress)

        const tx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: senderPublicKey,
            toPubkey: recipient,
            lamports: 1000
          })
        )

        account._connection.getLatestBlockhash = jest.fn().mockRejectedValue(
          new Error('Network error: failed to get recent blockhash')
        )

        await expect(account.sendTransaction(tx)).rejects.toThrow('Network error: failed to get recent blockhash')
      })

      it('should throw error when sendRawTransaction fails', async () => {
        const recipient = Keypair.generate().publicKey
        const senderAddress = await account.getAddress()
        const senderPublicKey = new PublicKey(senderAddress)

        const tx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: senderPublicKey,
            toPubkey: recipient,
            lamports: 1000
          })
        )

        account._connection.sendRawTransaction = jest.fn().mockRejectedValue(
          new Error('Transaction simulation failed: Insufficient funds')
        )

        await expect(account.sendTransaction(tx)).rejects.toThrow('Transaction simulation failed: Insufficient funds')
      })

      it('should throw error when confirmTransaction fails', async () => {
        const recipient = Keypair.generate().publicKey
        const senderAddress = await account.getAddress()
        const senderPublicKey = new PublicKey(senderAddress)

        const tx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: senderPublicKey,
            toPubkey: recipient,
            lamports: 1000
          })
        )

        const mockSignature = '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW'
        account._connection.sendRawTransaction = jest.fn().mockResolvedValue(mockSignature)

        account._connection.confirmTransaction = jest.fn().mockRejectedValue(
          new Error('Transaction confirmation timeout')
        )

        await expect(account.sendTransaction(tx)).rejects.toThrow('Transaction confirmation timeout')
      })

      it('should throw error when getFeeForMessage fails', async () => {
        const recipient = Keypair.generate().publicKey
        const senderAddress = await account.getAddress()
        const senderPublicKey = new PublicKey(senderAddress)

        const tx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: senderPublicKey,
            toPubkey: recipient,
            lamports: 1000
          })
        )

        account._connection.getFeeForMessage = jest.fn().mockRejectedValue(
          new Error('Failed to calculate transaction fee')
        )

        await expect(account.sendTransaction(tx)).rejects.toThrow('Failed to calculate transaction fee')
      })
    })

    describe('VersionedTransaction', () => {
      it('should send a versioned transaction successfully', async () => {
        const recipient = Keypair.generate().publicKey
        const senderAddress = await account.getAddress()
        const senderPublicKey = new PublicKey(senderAddress)

        const messageV0 = new TransactionMessage({
          payerKey: senderPublicKey,
          recentBlockhash: 'HhqkdqemrKDK5Wd4oiCtzfpBWfdGS79YhLtzAck5Nz7T',
          instructions: [
            SystemProgram.transfer({
              fromPubkey: senderPublicKey,
              toPubkey: recipient,
              lamports: 1000
            })
          ]
        }).compileToV0Message()

        const versionedTx = new VersionedTransaction(messageV0)

        const mockSignature = '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW'

        account._connection.sendRawTransaction = jest.fn().mockResolvedValue(mockSignature)
        account._connection.confirmTransaction = jest.fn().mockResolvedValue({
          value: { err: null }
        })

        const result = await account.sendTransaction(versionedTx)

        expect(result).toBeDefined()
        expect(result.hash).toBe(mockSignature)
        expect(result.fee).toBe(5000n)

        expect(account._connection.sendRawTransaction).toHaveBeenCalled()
        expect(account._connection.confirmTransaction).toHaveBeenCalled()
      })

      it('should throw error if versioned transaction has no blockhash', async () => {
        const recipient = Keypair.generate().publicKey
        const senderAddress = await account.getAddress()
        const senderPublicKey = new PublicKey(senderAddress)

        const messageV0 = new TransactionMessage({
          payerKey: senderPublicKey,
          recentBlockhash: '', // Empty blockhash
          instructions: [
            SystemProgram.transfer({
              fromPubkey: senderPublicKey,
              toPubkey: recipient,
              lamports: 1000
            })
          ]
        }).compileToV0Message()

        const versionedTx = new VersionedTransaction(messageV0)

        await expect(account.sendTransaction(versionedTx)).rejects.toThrow('VersionedTransaction must have a recentBlockhash set')
      })

      it('should validate fee payer in versioned transaction', async () => {
        const recipient = Keypair.generate().publicKey
        const wrongFeePayer = Keypair.generate().publicKey

        // Create message with wrong fee payer
        const messageV0 = new TransactionMessage({
          payerKey: wrongFeePayer,
          recentBlockhash: 'HhqkdqemrKDK5Wd4oiCtzfpBWfdGS79YhLtzAck5Nz7T',
          instructions: [
            SystemProgram.transfer({
              fromPubkey: wrongFeePayer,
              toPubkey: recipient,
              lamports: 1000
            })
          ]
        }).compileToV0Message()

        const versionedTx = new VersionedTransaction(messageV0)

        await expect(account.sendTransaction(versionedTx)).rejects.toThrow('Transaction fee payer must match wallet address')
      })

      it('should sign versioned transaction if not already signed', async () => {
        const recipient = Keypair.generate().publicKey
        const senderAddress = await account.getAddress()
        const senderPublicKey = new PublicKey(senderAddress)

        const messageV0 = new TransactionMessage({
          payerKey: senderPublicKey,
          recentBlockhash: 'HhqkdqemrKDK5Wd4oiCtzfpBWfdGS79YhLtzAck5Nz7T',
          instructions: [
            SystemProgram.transfer({
              fromPubkey: senderPublicKey,
              toPubkey: recipient,
              lamports: 1000
            })
          ]
        }).compileToV0Message()

        const versionedTx = new VersionedTransaction(messageV0)

        const mockSignature = '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW'
        account._connection.sendRawTransaction = jest.fn().mockResolvedValue(mockSignature)
        account._connection.confirmTransaction = jest.fn().mockResolvedValue({ value: { err: null } })

        expect(versionedTx.signatures.length).toBe(1)
        expect(versionedTx.signatures[0].every(byte => byte === 0)).toBe(true)

        await account.sendTransaction(versionedTx)

        expect(versionedTx.signatures.length).toBeGreaterThan(0)
        expect(versionedTx.signatures[0].every(byte => byte === 0)).toBe(false)
      })

      it('should handle versioned transaction with multiple instructions', async () => {
        const recipient1 = Keypair.generate().publicKey
        const recipient2 = Keypair.generate().publicKey
        const senderAddress = await account.getAddress()
        const senderPublicKey = new PublicKey(senderAddress)

        const messageV0 = new TransactionMessage({
          payerKey: senderPublicKey,
          recentBlockhash: 'HhqkdqemrKDK5Wd4oiCtzfpBWfdGS79YhLtzAck5Nz7T',
          instructions: [
            SystemProgram.transfer({
              fromPubkey: senderPublicKey,
              toPubkey: recipient1,
              lamports: 1000
            }),
            SystemProgram.transfer({
              fromPubkey: senderPublicKey,
              toPubkey: recipient2,
              lamports: 2000
            })
          ]
        }).compileToV0Message()

        const versionedTx = new VersionedTransaction(messageV0)

        const mockSignature = '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW'
        account._connection.sendRawTransaction = jest.fn().mockResolvedValue(mockSignature)
        account._connection.confirmTransaction = jest.fn().mockResolvedValue({ value: { err: null } })

        const result = await account.sendTransaction(versionedTx)

        expect(result.hash).toBe(mockSignature)
        expect(versionedTx.message.compiledInstructions.length).toBe(2)
      })

      it('should throw error when sendRawTransaction fails', async () => {
        const recipient = Keypair.generate().publicKey
        const senderAddress = await account.getAddress()
        const senderPublicKey = new PublicKey(senderAddress)

        const messageV0 = new TransactionMessage({
          payerKey: senderPublicKey,
          recentBlockhash: 'HhqkdqemrKDK5Wd4oiCtzfpBWfdGS79YhLtzAck5Nz7T',
          instructions: [
            SystemProgram.transfer({
              fromPubkey: senderPublicKey,
              toPubkey: recipient,
              lamports: 1000
            })
          ]
        }).compileToV0Message()

        const versionedTx = new VersionedTransaction(messageV0)

        account._connection.sendRawTransaction = jest.fn().mockRejectedValue(
          new Error('Transaction simulation failed: Blockhash not found')
        )

        await expect(account.sendTransaction(versionedTx)).rejects.toThrow('Transaction simulation failed: Blockhash not found')
      })

      it('should throw error when confirmTransaction fails', async () => {
        const recipient = Keypair.generate().publicKey
        const senderAddress = await account.getAddress()
        const senderPublicKey = new PublicKey(senderAddress)

        const messageV0 = new TransactionMessage({
          payerKey: senderPublicKey,
          recentBlockhash: 'HhqkdqemrKDK5Wd4oiCtzfpBWfdGS79YhLtzAck5Nz7T',
          instructions: [
            SystemProgram.transfer({
              fromPubkey: senderPublicKey,
              toPubkey: recipient,
              lamports: 1000
            })
          ]
        }).compileToV0Message()

        const versionedTx = new VersionedTransaction(messageV0)

        const mockSignature = '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW'
        account._connection.sendRawTransaction = jest.fn().mockResolvedValue(mockSignature)

        // Mock confirmTransaction to fail
        account._connection.confirmTransaction = jest.fn().mockRejectedValue(
          new Error('Transaction confirmation timeout')
        )

        await expect(account.sendTransaction(versionedTx)).rejects.toThrow('Transaction confirmation timeout')
      })

      it('should throw error when getFeeForMessage fails', async () => {
        const recipient = Keypair.generate().publicKey
        const senderAddress = await account.getAddress()
        const senderPublicKey = new PublicKey(senderAddress)

        const messageV0 = new TransactionMessage({
          payerKey: senderPublicKey,
          recentBlockhash: 'HhqkdqemrKDK5Wd4oiCtzfpBWfdGS79YhLtzAck5Nz7T',
          instructions: [
            SystemProgram.transfer({
              fromPubkey: senderPublicKey,
              toPubkey: recipient,
              lamports: 1000
            })
          ]
        }).compileToV0Message()

        const versionedTx = new VersionedTransaction(messageV0)

        // Mock getFeeForMessage to fail
        account._connection.getFeeForMessage = jest.fn().mockRejectedValue(
          new Error('Failed to calculate transaction fee')
        )

        await expect(account.sendTransaction(versionedTx)).rejects.toThrow('Failed to calculate transaction fee')
      })

      it('should throw error when getLatestBlockhash fails during confirmation', async () => {
        const recipient = Keypair.generate().publicKey
        const senderAddress = await account.getAddress()
        const senderPublicKey = new PublicKey(senderAddress)

        const messageV0 = new TransactionMessage({
          payerKey: senderPublicKey,
          recentBlockhash: 'HhqkdqemrKDK5Wd4oiCtzfpBWfdGS79YhLtzAck5Nz7T',
          instructions: [
            SystemProgram.transfer({
              fromPubkey: senderPublicKey,
              toPubkey: recipient,
              lamports: 1000
            })
          ]
        }).compileToV0Message()

        const versionedTx = new VersionedTransaction(messageV0)

        const mockSignature = '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW'
        account._connection.sendRawTransaction = jest.fn().mockResolvedValue(mockSignature)

        // Mock getLatestBlockhash to fail (called after sendRawTransaction for confirmation)
        account._connection.getLatestBlockhash = jest.fn().mockRejectedValue(
          new Error('Network error: failed to get blockhash for confirmation')
        )

        await expect(account.sendTransaction(versionedTx)).rejects.toThrow('Network error: failed to get blockhash for confirmation')
      })
    })

    describe('Error Handling', () => {
      it('should throw error for unsupported transaction type', async () => {
        const invalidTx = { to: 'some-address', value: 1000 }

        await expect(account.sendTransaction(invalidTx)).rejects.toThrow('Unsupported transaction type')
      })

      it('should throw error when not connected to provider', async () => {
        const tempAccount = new WalletAccountSolana(
          TEST_SEED_PHRASE,
          "0'/0/0",
          {} // No rpcUrl
        )

        const tx = new Transaction()

        await expect(tempAccount.sendTransaction(tx)).rejects.toThrow('The wallet must be connected to a provider')
      })
    })
  })

  describe('transfer', () => {
    let originalGetLatestBlockhash
    let originalGetFeeForMessage
    let originalGetAccountInfo
    let originalSendTransaction

    const MOCK_TOKEN_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB' // USDT mint
    const MOCK_RECIPIENT = 'HmWPZeFgxZAJQYgwh5ipYwjbVTHtjEHB3dnJ5xcQBHX9'
    const MOCK_AMOUNT = 1000000n // 1 USDT (6 decimals)

    beforeEach(() => {
      originalGetLatestBlockhash = account._connection.getLatestBlockhash
      originalGetFeeForMessage = account._connection.getFeeForMessage
      originalGetAccountInfo = account._connection.getAccountInfo
      originalSendTransaction = account.sendTransaction

      account._connection.getLatestBlockhash = jest.fn().mockResolvedValue({
        blockhash: 'HhqkdqemrKDK5Wd4oiCtzfpBWfdGS79YhLtzAck5Nz7T',
        lastValidBlockHeight: 100000
      })

      account._connection.getFeeForMessage = jest.fn().mockResolvedValue({
        value: 5000
      })
    })

    afterEach(() => {
      account._connection.getLatestBlockhash = originalGetLatestBlockhash
      account._connection.getFeeForMessage = originalGetFeeForMessage
      account._connection.getAccountInfo = originalGetAccountInfo
      account.sendTransaction = originalSendTransaction
    })

    it('should transfer tokens when recipient ATA exists', async () => {
      // Mock recipient ATA exists
      account._connection.getAccountInfo = jest.fn().mockResolvedValue({
        owner: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
        lamports: 2039280,
        data: Buffer.alloc(165)
      })

      const mockSignature = '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW'

      // Mock sendTransaction
      account.sendTransaction = jest.fn().mockResolvedValue({
        hash: mockSignature,
        fee: 5000n
      })

      const result = await account.transfer({
        token: MOCK_TOKEN_MINT,
        recipient: MOCK_RECIPIENT,
        amount: MOCK_AMOUNT
      })

      expect(result).toBeDefined()
      expect(result.hash).toBe(mockSignature)
      expect(result.fee).toBe(5000n)

      expect(account._connection.getAccountInfo).toHaveBeenCalled()
      expect(account.sendTransaction).toHaveBeenCalled()
    })

    it('should create recipient ATA and transfer when ATA does not exist', async () => {
      // Mock recipient ATA does NOT exist
      account._connection.getAccountInfo = jest.fn().mockResolvedValue(null)

      const mockSignature = '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW'

      account.sendTransaction = jest.fn().mockResolvedValue({
        hash: mockSignature,
        fee: 7000n // Higher fee due to ATA creation
      })

      const result = await account.transfer({
        token: MOCK_TOKEN_MINT,
        recipient: MOCK_RECIPIENT,
        amount: MOCK_AMOUNT
      })

      expect(result).toBeDefined()
      expect(result.hash).toBe(mockSignature)
      expect(result.fee).toBe(7000n)

      expect(account._connection.getAccountInfo).toHaveBeenCalled()
      expect(account.sendTransaction).toHaveBeenCalled()
      const txArg = account.sendTransaction.mock.calls[0][0]
      expect(txArg.instructions.length).toBe(2) // Create ATA + Transfer
    })

    it('should handle large token amounts', async () => {
      account._connection.getAccountInfo = jest.fn().mockResolvedValue({
        owner: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
        lamports: 2039280,
        data: Buffer.alloc(165)
      })

      const mockSignature = '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW'
      account.sendTransaction = jest.fn().mockResolvedValue({
        hash: mockSignature,
        fee: 5000n
      })

      const largeAmount = 1000000000000n // 1 million tokens

      const result = await account.transfer({
        token: MOCK_TOKEN_MINT,
        recipient: MOCK_RECIPIENT,
        amount: largeAmount
      })

      expect(result.hash).toBe(mockSignature)
    })

    it('should respect transferMaxFee limit when fee is within limit', async () => {
      // Create account with transferMaxFee
      const walletWithMaxFee = new WalletManagerSolana(TEST_SEED_PHRASE, {
        rpcUrl: TEST_RPC_URL,
        commitment: 'confirmed',
        transferMaxFee: 10000 // 10000 lamports max
      })
      const accountWithMaxFee = await walletWithMaxFee.getAccount(0)

      // Mock methods for new account
      accountWithMaxFee._connection.getLatestBlockhash = jest.fn().mockResolvedValue({
        blockhash: 'HhqkdqemrKDK5Wd4oiCtzfpBWfdGS79YhLtzAck5Nz7T',
        lastValidBlockHeight: 100000
      })

      accountWithMaxFee._connection.getAccountInfo = jest.fn().mockResolvedValue({
        owner: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
        lamports: 2039280,
        data: Buffer.alloc(165)
      })

      // Mock fee within limit
      accountWithMaxFee._connection.getFeeForMessage = jest.fn().mockResolvedValue({
        value: 5000 // Within 10000 limit
      })

      const mockSignature = '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW'
      accountWithMaxFee.sendTransaction = jest.fn().mockResolvedValue({
        hash: mockSignature,
        fee: 5000n
      })

      const result = await accountWithMaxFee.transfer({
        token: MOCK_TOKEN_MINT,
        recipient: MOCK_RECIPIENT,
        amount: MOCK_AMOUNT
      })

      expect(result.hash).toBe(mockSignature)
      expect(accountWithMaxFee.sendTransaction).toHaveBeenCalled()
    })

    it('should set correct transaction properties', async () => {
      account._connection.getAccountInfo = jest.fn().mockResolvedValue({
        owner: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
        lamports: 2039280,
        data: Buffer.alloc(165)
      })

      const mockSignature = '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW'
      account.sendTransaction = jest.fn().mockResolvedValue({
        hash: mockSignature,
        fee: 5000n
      })

      await account.transfer({
        token: MOCK_TOKEN_MINT,
        recipient: MOCK_RECIPIENT,
        amount: MOCK_AMOUNT
      })

      const txArg = account.sendTransaction.mock.calls[0][0]
      const senderAddress = await account.getAddress()
      const senderPublicKey = new PublicKey(senderAddress)

      expect(txArg.feePayer).toEqual(senderPublicKey)
      expect(txArg.recentBlockhash).toBe('HhqkdqemrKDK5Wd4oiCtzfpBWfdGS79YhLtzAck5Nz7T')
      expect(txArg.signatures.length).toBe(0)
    })

    it('should handle transfer with minimum amount', async () => {
      account._connection.getAccountInfo = jest.fn().mockResolvedValue({
        owner: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
        lamports: 2039280,
        data: Buffer.alloc(165)
      })

      const mockSignature = '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW'
      account.sendTransaction = jest.fn().mockResolvedValue({
        hash: mockSignature,
        fee: 5000n
      })

      const minAmount = 1n

      const result = await account.transfer({
        token: MOCK_TOKEN_MINT,
        recipient: MOCK_RECIPIENT,
        amount: minAmount
      })

      expect(result.hash).toBe(mockSignature)
    })

    it('should throw error when fee exceeds transferMaxFee', async () => {
      const walletWithMaxFee = new WalletManagerSolana(TEST_SEED_PHRASE, {
        rpcUrl: TEST_RPC_URL,
        commitment: 'confirmed',
        transferMaxFee: 3000 // Low limit
      })
      const accountWithMaxFee = await walletWithMaxFee.getAccount(0)

      // Mock methods
      accountWithMaxFee._connection.getLatestBlockhash = jest.fn().mockResolvedValue({
        blockhash: 'HhqkdqemrKDK5Wd4oiCtzfpBWfdGS79YhLtzAck5Nz7T',
        lastValidBlockHeight: 100000
      })

      accountWithMaxFee._connection.getAccountInfo = jest.fn().mockResolvedValue({
        owner: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
        lamports: 2039280,
        data: Buffer.alloc(165)
      })

      accountWithMaxFee._connection.getFeeForMessage = jest.fn().mockResolvedValue({
        value: 5000 // Exceeds 3000 limit
      })

      await expect(accountWithMaxFee.transfer({
        token: MOCK_TOKEN_MINT,
        recipient: MOCK_RECIPIENT,
        amount: MOCK_AMOUNT
      })).rejects.toThrow('Exceeded maximum fee cost for transfer operation')
    })

    it('should throw error when getAccountInfo fails', async () => {
      // Mock getAccountInfo to fail
      account._connection.getAccountInfo = jest.fn().mockRejectedValue(
        new Error('Network error: failed to fetch account info')
      )

      await expect(account.transfer({
        token: MOCK_TOKEN_MINT,
        recipient: MOCK_RECIPIENT,
        amount: MOCK_AMOUNT
      })).rejects.toThrow('Network error: failed to fetch account info')
    })

    it('should throw error when getLatestBlockhash fails', async () => {
      account._connection.getAccountInfo = jest.fn().mockResolvedValue(null)

      // Mock getLatestBlockhash to fail
      account._connection.getLatestBlockhash = jest.fn().mockRejectedValue(
        new Error('Network error: failed to get recent blockhash')
      )

      await expect(account.transfer({
        token: MOCK_TOKEN_MINT,
        recipient: MOCK_RECIPIENT,
        amount: MOCK_AMOUNT
      })).rejects.toThrow('Network error: failed to get recent blockhash')
    })

    it('should throw error when getFeeForMessage fails', async () => {
      account._connection.getAccountInfo = jest.fn().mockResolvedValue(null)

      // Mock getFeeForMessage to fail
      account._connection.getFeeForMessage = jest.fn().mockRejectedValue(
        new Error('Failed to calculate transaction fee')
      )

      await expect(account.transfer({
        token: MOCK_TOKEN_MINT,
        recipient: MOCK_RECIPIENT,
        amount: MOCK_AMOUNT
      })).rejects.toThrow('Failed to calculate transaction fee')
    })

    it('should throw error when sendTransaction fails', async () => {
      account._connection.getAccountInfo = jest.fn().mockResolvedValue({
        owner: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
        lamports: 2039280,
        data: Buffer.alloc(165)
      })

      // Mock sendTransaction to fail
      account.sendTransaction = jest.fn().mockRejectedValue(
        new Error('Transaction simulation failed: Insufficient token balance')
      )

      await expect(account.transfer({
        token: MOCK_TOKEN_MINT,
        recipient: MOCK_RECIPIENT,
        amount: MOCK_AMOUNT
      })).rejects.toThrow('Transaction simulation failed: Insufficient token balance')
    })

    it('should throw error for invalid token mint address', async () => {
      const invalidToken = 'invalid-token-address'

      await expect(account.transfer({
        token: invalidToken,
        recipient: MOCK_RECIPIENT,
        amount: MOCK_AMOUNT
      })).rejects.toThrow()
    })

    it('should throw error for invalid recipient address', async () => {
      const invalidRecipient = 'invalid-recipient-address'

      await expect(account.transfer({
        token: MOCK_TOKEN_MINT,
        recipient: invalidRecipient,
        amount: MOCK_AMOUNT
      })).rejects.toThrow()
    })

    it('should throw error when Token.getAssociatedTokenAddress fails', async () => {
      const invalidToken = '11111111111111111111111111111111' // System program, not a token

      account._connection.getAccountInfo = jest.fn().mockResolvedValue(null)

      // This should fail when trying to get associated token address
      await expect(account.transfer({
        token: invalidToken,
        recipient: MOCK_RECIPIENT,
        amount: MOCK_AMOUNT
      })).rejects.toThrow()
    })

    it('should handle error during ATA creation', async () => {
      account._connection.getAccountInfo = jest.fn().mockResolvedValue(null)
      account.sendTransaction = jest.fn().mockRejectedValue(
        new Error('Transaction failed: Insufficient funds for rent')
      )

      await expect(account.transfer({
        token: MOCK_TOKEN_MINT,
        recipient: MOCK_RECIPIENT,
        amount: MOCK_AMOUNT
      })).rejects.toThrow('Transaction failed: Insufficient funds for rent')
    })

    it('should throw error when fee check exceeds limit with ATA creation', async () => {
      // Create account with transferMaxFee
      const walletWithMaxFee = new WalletManagerSolana(TEST_SEED_PHRASE, {
        rpcUrl: TEST_RPC_URL,
        commitment: 'confirmed',
        transferMaxFee: 6000
      })
      const accountWithMaxFee = await walletWithMaxFee.getAccount(0)

      accountWithMaxFee._connection.getLatestBlockhash = jest.fn().mockResolvedValue({
        blockhash: 'HhqkdqemrKDK5Wd4oiCtzfpBWfdGS79YhLtzAck5Nz7T',
        lastValidBlockHeight: 100000
      })

      accountWithMaxFee._connection.getAccountInfo = jest.fn().mockResolvedValue(null)
      accountWithMaxFee._connection.getFeeForMessage = jest.fn().mockResolvedValue({
        value: 8000 // Exceeds 6000 limit
      })

      await expect(accountWithMaxFee.transfer({
        token: MOCK_TOKEN_MINT,
        recipient: MOCK_RECIPIENT,
        amount: MOCK_AMOUNT
      })).rejects.toThrow('Exceeded maximum fee cost for transfer operation')
    })
  })
})