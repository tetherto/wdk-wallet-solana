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
import {
  appendTransactionMessageInstruction,
  createTransactionMessage,
  getCompiledTransactionMessageDecoder,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash
} from '@solana/transaction-messages'
import {
  createKeyPairSignerFromPrivateKeyBytes,
  setTransactionMessageFeePayerSigner,
  signTransactionMessageWithSigners
} from '@solana/signers'
import { getBase64EncodedWireTransaction, getTransactionDecoder } from '@solana/transactions'
import { getBase58Decoder, getBase64Decoder, getBase64Encoder } from '@solana/codecs'
import { MEMO_PROGRAM_ADDRESS, getAddMemoInstruction } from '@solana-program/memo'
import { SYSTEM_PROGRAM_ADDRESS } from '@solana-program/system'
import { TOKEN_PROGRAM_ADDRESS } from '@solana-program/token'
import { DisposalError } from '@tetherto/wdk-wallet'
import * as bip39 from 'bip39'

import WalletManagerSolana from '../src/wallet-manager-solana.js'
import WalletAccountSolana from '../src/wallet-account-solana.js'
import WalletAccountReadOnlySolana from '../src/wallet-account-read-only-solana.js'
import SeedSignerSolana from '../src/signers/seed-signer-solana.js'

const TEST_SEED_PHRASE =
  'test walk nut penalty hip pave soap entry language right filter choice'
const TEST_RPC_URL = 'https://mockurl.com'

const TEST_SEED = bip39.mnemonicToSeedSync(TEST_SEED_PHRASE)

const ACCOUNT_0 = {
  path: "m/44'/501'/0'/0'",
  address: '3uXqWpwgqKVdiHAwF6Vmu4G4vdQzpR66xjPkz1G7zMKE',
  privateKey: 'de705bcaa34a2ea50c0b7e6e584006f2458652fa9d6e20994ac146852490c76f',
  publicKey: '2b2c715c2cf24db57e95a44df34cb424de2460e86c4f6ebe7ba62b574830de19'
}

const ACCOUNT_1 = {
  address: 'CfGcujEkPVDx7yGyn1PUjxn2e353MXbLk8ixzwuJUktK',
  privateKey: '4642fc818f6525a2c5ae784cc98f44d639492c21271c5f7f0ac30ee95a3357bb',
  publicKey: 'ad3e499bc158a797574c53bcca546939f0de16242b85ed39a848092c4d9d5274'
}

const ACCOUNT_2_ADDRESS = 'Grwp8oDHgAD8PVSS51pWGCY5QRM3hqiH8QcbPRAEUABq'

const COIN_NODE_PATH = "m/44'/501'"

const COIN_NODE_ADDRESS = 'Ccy4BT4c7QRNJCpu2q3uuDgktB5kZqifuRCiueuajKL1'

const PATH_ADDRESSES = {
  "0'/0'/0'": 'DPGHHHMaayXkaThUJCUnUAJCdgc9sxNh1UEGa6vJximM',
  "0'/0'/1'": 'jbhYXhWfRPqPvaKqaWCJEgBdZMquFxUvjWaWLEH3YCz',
  "1'/0'/0'": '57hwCai22XueypvXcXKotkuAQYj2eukFcY5ymWB7Arvg'
}

const PATH_000_SIGNATURE = 'ed1cc68bc191ed6c24b22654ee42d7a2b782e67b75f188a987fcc3037ee3bb0f0990c28c1b32d04da89f1be8d0a2f0da45d91ddb2f3613c8cb79263dba4c8906'

const MESSAGE_SIGNATURES = {
  'Test message': '90d1d5dc7430f3efa9fa037ba2179458fad9a8bfdf42ba74fff4581ce9e0ac2fba1562483b072e9eee709ef8d59448b379d9a61e634b37a3c13858bab7754f08',
  'Message 1': '06f06d64f9a5338595410825aee9ae6b04bd0069fcd36afca765f75b3c4ebb42c2ee35a62961b8edc3afc1d10b50dcdb558d9904707326236598d0b7c0385204',
  'Message 2': 'c4d4f624a1d7ba1992cdfd6ce5a8a3e7e2ac46ad342ef8b00b8c10f73633223a882ff8230b009691d57291aa6224a648371f9208c447ed695be47ec395a6ad0d'
}

const COSIGNED_TRANSACTION_SIGNATURES = {
  feePayer: '4xsE4C6a79AaoAeTaLZwM57ce9q92gMKV1Yd53hSFhc1J2q1JVSqzCZHSNrY9uVotESpAMMvRzA3B81umcWCa3vA',
  cosigner: '5SjRUVhgWVDvzbu1A2HKyVPCN6UxJctrUS9WZoakB1JVz8jwGwp312yNhnRjVjmPYySkvCpVpuyLsk4XS9ycnLg'
}

const MOCK_BLOCKHASH = '6JbYxigC1rn83PMHZait5FHHpC3YqUMacnVJWFwfoayQ'

const MOCK_LAST_VALID_BLOCK_HEIGHT = 1000000

const MOCK_FEE = 5000

const MOCK_SIGNATURE = 'mock-signature'

const RECIPIENT_ADDRESS = '9CXtfmGEtfjmtPKnq2QZcRzCiMzE9T8NQfRicJZetvk2'

const OTHER_RECIPIENT_ADDRESS = '8KpbCiK2SfNRNqosmkfvys5itK6CbjcxLXG8e2gLgzmP'

const TOKEN_RECIPIENT_ADDRESS = 'ASbM8cPUrBxgjgNuu3hQSK2JSDDG6HhQ9FqU3ofprkMV'

const DUMMY_ADDRESS = 'FzFRHEc1tWLGa2doGw2KAKrfNrBH3QwGTnjm37o2HQGb'

const FOREIGN_FEE_PAYER_ADDRESS = 'DifferentAddress11111111111111111111111'

const USDT_MINT_ADDRESS = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'

// Manually builds a fully-signed transaction using the Solana SDK directly,
// without relying on the account's `signTransaction` method.
async function buildSignedTransaction (account, tx) {
  const transactionMessage = await account._prepareTransactionMessage(tx)
  const signer = await createKeyPairSignerFromPrivateKeyBytes(account.keyPair.privateKey)

  return await signTransactionMessageWithSigners(setTransactionMessageFeePayerSigner(signer, transactionMessage))
}

describe('WalletAccountSolana', () => {
  let wallet
  let account

  beforeAll(async () => {
    wallet = new WalletManagerSolana(TEST_SEED_PHRASE, {
      provider: TEST_RPC_URL,
      commitment: 'processed'
    })

    account = await wallet.getAccount(0)
  })
  describe('Wallet Properties', () => {
    describe('seed', () => {
      it('should throw if invalid words in seed phrase', async () => {
        expect(() => {
          new WalletAccountSolana(
            'invalid word that does not exist test test test test test test test',
            "0'/0'/0'",
            {
              provider: TEST_RPC_URL,
              commitment: 'processed'
            }
          )
        }).toThrow('The seed phrase is invalid')
      })

      it('should accept valid BIP-39 seed phrase as string', async () => {
        const account = new WalletAccountSolana(
          TEST_SEED_PHRASE,
          "0'/0'/0'",
          {
            provider: TEST_RPC_URL,
            commitment: 'confirmed'
          }
        )

        expect(account).toBeDefined()
        expect(account).toBeInstanceOf(WalletAccountSolana)
      })
    })

    describe('signer', () => {
      it('should take the path, address and key of a derived signer', async () => {
        const signer = await new SeedSignerSolana(TEST_SEED_PHRASE).derive("0'/0'/0'")
        const account = new WalletAccountSolana(signer, { provider: TEST_RPC_URL })

        expect(account.path).toBe("m/44'/501'/0'/0'/0'")
        expect(await account.getAddress()).toBe(PATH_ADDRESSES["0'/0'/0'"])
        expect(await account.sign('Hello, Solana!')).toBe(PATH_000_SIGNATURE)
      })

      it('should derive the first account when no path is given', async () => {
        const account = new WalletAccountSolana(TEST_SEED_PHRASE, { provider: TEST_RPC_URL })

        expect(account.path).toBe(ACCOUNT_0.path)
        expect(await account.getAddress()).toBe(ACCOUNT_0.address)
      })

      it('should derive the first account when neither a path nor a config is given', async () => {
        const account = new WalletAccountSolana(TEST_SEED_PHRASE)

        expect(account.path).toBe(ACCOUNT_0.path)
        expect(await account.getAddress()).toBe(ACCOUNT_0.address)
      })

      it('should derive the account from a raw seed', async () => {
        const account = new WalletAccountSolana(TEST_SEED, "0'/0'", { provider: TEST_RPC_URL })

        expect(account.path).toBe(ACCOUNT_0.path)
        expect(await account.getAddress()).toBe(ACCOUNT_0.address)
      })

      it('should accept a signer at the coin-type node', async () => {
        const account = new WalletAccountSolana(new SeedSignerSolana(TEST_SEED_PHRASE), {})

        expect(account.path).toBe(COIN_NODE_PATH)
        expect(await account.getAddress()).toBe(COIN_NODE_ADDRESS)
      })

      it('should throw if the signer path is not absolute', () => {
        expect(() => new SeedSignerSolana(TEST_SEED_PHRASE, "44'/501'"))
          .toThrow('The derivation path must be absolute')
      })

      it('should throw if the derivation path is not fully hardened', () => {
        expect(() => new WalletAccountSolana(TEST_SEED_PHRASE, "0'/0/0'", {}))
          .toThrow('In Solana, every child path in a derivation path must be hardened.')
      })
    })

    describe('getAddress', () => {
      it('should return a valid Solana address', async () => {
        const address = await account.getAddress()
        expect(address).toMatch(ACCOUNT_0.address)
      })

      it('should return different addresses for different account indices', async () => {
        const account0 = await wallet.getAccount(0)
        const account1 = await wallet.getAccount(1)
        const account2 = await wallet.getAccount(2)

        const address0 = await account0.getAddress()
        const address1 = await account1.getAddress()
        const address2 = await account2.getAddress()

        expect(address0).toMatch(ACCOUNT_0.address)
        expect(address1).toMatch(ACCOUNT_1.address)
        expect(address2).toMatch(ACCOUNT_2_ADDRESS)
      })

      it('should return different addresses for different derivation paths', async () => {
        const accountPath1 = await wallet.getAccountByPath("0'/0'/0'")
        const accountPath2 = await wallet.getAccountByPath("0'/0'/1'")
        const accountPath3 = await wallet.getAccountByPath("1'/0'/0'")

        const address1 = await accountPath1.getAddress()
        const address2 = await accountPath2.getAddress()
        const address3 = await accountPath3.getAddress()

        expect(address1).toMatch(PATH_ADDRESSES["0'/0'/0'"])
        expect(address2).toMatch(PATH_ADDRESSES["0'/0'/1'"])
        expect(address3).toMatch(PATH_ADDRESSES["1'/0'/0'"])
      })
    })

    describe('keyPair', () => {
      it('should have consistent keyPair', () => {
        const keyPair = account.keyPair
        expect(Buffer.from(keyPair.publicKey).toString('hex')).toBe(ACCOUNT_0.publicKey)
        expect(Buffer.from(keyPair.privateKey).toString('hex')).toBe(ACCOUNT_0.privateKey)
      })

      it('should have different key pairs for different accounts', async () => {
        const account0 = await wallet.getAccount(0)
        const account1 = await wallet.getAccount(1)

        const keyPair0 = account0.keyPair
        const keyPair1 = account1.keyPair

        expect(Buffer.from(keyPair0.publicKey).toString('hex')).toBe(ACCOUNT_0.publicKey)
        expect(Buffer.from(keyPair0.privateKey).toString('hex')).toBe(ACCOUNT_0.privateKey)
        expect(Buffer.from(keyPair1.publicKey).toString('hex')).toBe(ACCOUNT_1.publicKey)
        expect(Buffer.from(keyPair1.privateKey).toString('hex')).toBe(ACCOUNT_1.privateKey)
      })
    })

    describe('path', () => {
      it('should follow SLIP-0010 Solana derivation path format', () => {
        const path = account.path

        expect(path).toMatch(ACCOUNT_0.path)
      })

      it('should have correct path for account index 0', async () => {
        const account0 = await wallet.getAccount(0)
        expect(account0.path).toBe(ACCOUNT_0.path)
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

    describe('fromPrivateKey', () => {
      it('should create the account of the private key', async () => {
        const account = WalletAccountSolana.fromPrivateKey(ACCOUNT_0.privateKey, { provider: TEST_RPC_URL })

        expect(account).toBeInstanceOf(WalletAccountSolana)
        expect(account.path).toBeNull()
        expect(await account.getAddress()).toBe(ACCOUNT_0.address)
      })

      it('should wipe the signer it created on dispose', () => {
        const account = WalletAccountSolana.fromPrivateKey(ACCOUNT_0.privateKey)

        account.dispose()

        expect(account.keyPair.privateKey).toBeNull()
      })
    })

    describe('signer ownership', () => {
      it('should not wipe a signer supplied by the caller on dispose', async () => {
        const signer = await new SeedSignerSolana(TEST_SEED_PHRASE).derive("0'/0'")
        const account = new WalletAccountSolana(signer, {})

        account.dispose()

        expect(Buffer.from(signer.keyPair.privateKey).toString('hex')).toBe(ACCOUNT_0.privateKey)
        await expect(account.sign('Hello, Solana!')).rejects.toThrow(new DisposalError('The wallet account has been disposed.'))
      })

      it('should wipe a caller-supplied signer when asked to', async () => {
        const signer = await new SeedSignerSolana(TEST_SEED_PHRASE).derive("0'/0'")
        const account = new WalletAccountSolana(signer, { shouldWipeSignerOnDisposal: true })

        account.dispose()

        expect(signer.keyPair.privateKey).toBeNull()
      })

      it('should wipe the signer it built from a seed', () => {
        const account = new WalletAccountSolana(TEST_SEED_PHRASE)

        account.dispose()

        expect(account.keyPair.privateKey).toBeNull()
      })

      it('should wipe the signer it built from a raw seed', () => {
        const account = new WalletAccountSolana(TEST_SEED)

        account.dispose()

        expect(account.keyPair.privateKey).toBeNull()
      })
    })

    describe('dispose', () => {
      it('should be marked as disposed only after dispose', () => {
        const account = WalletAccountSolana.fromPrivateKey(ACCOUNT_0.privateKey)

        expect(account.disposed).toBe(false)

        account.dispose()

        expect(account.disposed).toBe(true)
      })

      it('should clear private key from memory', async () => {
        const tempWallet = new WalletManagerSolana(TEST_SEED_PHRASE, {
          provider: TEST_RPC_URL,
          commitment: 'confirmed'
        })
        const tempAccount = await tempWallet.getAccount(99)

        const keyPairBefore = tempAccount.keyPair
        expect(keyPairBefore.privateKey).toBeTruthy()

        tempAccount.dispose()
        const keyPairAfter = tempAccount.keyPair
        expect(keyPairAfter.privateKey).toBeNull()
      })

      it('should dispose all accounts when wallet manager is disposed', async () => {
        const tempWallet = new WalletManagerSolana(TEST_SEED_PHRASE, {
          provider: TEST_RPC_URL,
          commitment: 'confirmed'
        })

        const account0 = await tempWallet.getAccount(0)
        const account1 = await tempWallet.getAccount(1)
        const account2 = await tempWallet.getAccount(2)

        expect(account0.keyPair.privateKey).toBeTruthy()
        expect(account1.keyPair.privateKey).toBeTruthy()
        expect(account2.keyPair.privateKey).toBeTruthy()

        tempWallet.dispose()

        expect(account0.keyPair.privateKey).toBeNull()
        expect(account1.keyPair.privateKey).toBeNull()
        expect(account2.keyPair.privateKey).toBeNull()
      })

      it('should keep public key accessible after disposal', async () => {
        const tempWallet = new WalletManagerSolana(TEST_SEED_PHRASE, {
          provider: TEST_RPC_URL,
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

        expect(signature).toBe(MESSAGE_SIGNATURES['Test message'])
      })

      it('should produce different signatures for different messages', async () => {
        const message1 = 'Message 1'
        const message2 = 'Message 2'

        const signature1 = await account.sign(message1)
        const signature2 = await account.sign(message2)

        expect(signature1).toBe(MESSAGE_SIGNATURES['Message 1'])
        expect(signature2).toBe(MESSAGE_SIGNATURES['Message 2'])
      })

      it('should throw error after account disposal', async () => {
        const tempWallet = new WalletManagerSolana(TEST_SEED_PHRASE, {
          provider: TEST_RPC_URL,
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
              blockhash: MOCK_BLOCKHASH,
              lastValidBlockHeight: MOCK_LAST_VALID_BLOCK_HEIGHT
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
          provider: TEST_RPC_URL,
          commitment: 'confirmed'
        })
        const tempAccount = await tempWallet.getAccount(90)

        tempAccount.dispose()

        await expect(
          tempAccount.sendTransaction({ to: 'DummyAddress', value: 1000n })
        ).rejects.toThrow(new DisposalError('The wallet account has been disposed.'))
      })
    })

    describe('Native Transfer Transaction', () => {
      it('should accept simple {to, value} transaction format', async () => {
        mockRpc.getFeeForMessage.mockReturnValue({
          send: jest.fn().mockResolvedValue({ value: MOCK_FEE })
        })
        mockRpc.sendTransaction.mockReturnValue({
          send: jest.fn().mockResolvedValue(MOCK_SIGNATURE)
        })
        mockRpc.getSignatureStatuses.mockReturnValue({
          send: jest.fn().mockResolvedValue({
            value: [{ err: null, confirmationStatus: 'confirmed' }]
          })
        })

        account._rpc = mockRpc

        const tx = {
          to: RECIPIENT_ADDRESS,
          value: 1000000n
        }

        const result = await account.sendTransaction(tx, {
          skipConfirmation: true
        })

        expect(result).toBeDefined()
        expect(result.hash).toBe(MOCK_SIGNATURE)
        expect(result.fee).toBe(BigInt(MOCK_FEE))
        expect(mockRpc.sendTransaction).toHaveBeenCalled()
      })

      it('should handle bigint and number values', async () => {
        mockRpc.getFeeForMessage.mockReturnValue({
          send: jest.fn().mockResolvedValue({ value: MOCK_FEE })
        })
        mockRpc.sendTransaction.mockReturnValue({
          send: jest.fn().mockResolvedValue(MOCK_SIGNATURE)
        })

        account._rpc = mockRpc

        await account.sendTransaction(
          {
            to: OTHER_RECIPIENT_ADDRESS,
            value: 1000000n
          },
          { skipConfirmation: true }
        )

        await account.sendTransaction(
          {
            to: OTHER_RECIPIENT_ADDRESS,
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
          send: jest.fn().mockResolvedValue({ value: MOCK_FEE })
        })
        mockRpc.sendTransaction.mockReturnValue({
          send: jest.fn().mockResolvedValue(MOCK_SIGNATURE)
        })

        account._rpc = mockRpc

        const txMessage = {
          instructions: [
            {
              programAddress: SYSTEM_PROGRAM_ADDRESS,
              accounts: [],
              data: new Uint8Array()
            }
          ],
          version: 0
        }

        const result = await account.sendTransaction(txMessage)

        expect(result.hash).toBe(MOCK_SIGNATURE)
        expect(mockRpc.sendTransaction).toHaveBeenCalled()
      })

      it('should add fee payer if missing', async () => {
        mockRpc.getFeeForMessage.mockReturnValue({
          send: jest.fn().mockResolvedValue({ value: MOCK_FEE })
        })
        mockRpc.sendTransaction.mockReturnValue({
          send: jest.fn().mockResolvedValue(MOCK_SIGNATURE)
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
          send: jest.fn().mockResolvedValue({ value: MOCK_FEE })
        })
        mockRpc.sendTransaction.mockReturnValue({
          send: jest.fn().mockResolvedValue(MOCK_SIGNATURE)
        })

        account._rpc = mockRpc

        const accountAddress = await account.getAddress()

        const txMessage = {
          instructions: [
            {
              programAddress: SYSTEM_PROGRAM_ADDRESS,
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

        expect(result.hash).toBe(MOCK_SIGNATURE)
        expect(mockRpc.sendTransaction).toHaveBeenCalled()
      })

      it('should throw if fee payer does not match account', async () => {
        account._rpc = mockRpc

        const txMessage = {
          instructions: [],
          version: 0,
          feePayer: {
            address: FOREIGN_FEE_PAYER_ADDRESS
          }
        }

        await expect(account.sendTransaction(txMessage)).rejects.toThrow(
          'does not match wallet address'
        )
      })
    })

    describe('Serialized Transaction Format', () => {
      // Builds an unsigned base64-encoded serialized transaction with the
      // given account as the fee payer, using the Solana SDK directly.
      async function buildSerializedTransaction (account, tx) {
        const address = await account.getAddress()
        const { messageBytes } = await buildSignedTransaction(account, tx)

        return getBase64EncodedWireTransaction({
          messageBytes,
          signatures: { [address]: null }
        })
      }

      const TX = {
        to: RECIPIENT_ADDRESS,
        value: 1000000n
      }

      beforeEach(() => {
        mockRpc.getFeeForMessage.mockReturnValue({
          send: jest.fn().mockResolvedValue({ value: MOCK_FEE })
        })
        mockRpc.sendTransaction.mockReturnValue({
          send: jest.fn().mockResolvedValue(MOCK_SIGNATURE)
        })

        account._rpc = mockRpc
      })

      it('should sign and broadcast a base64-encoded serialized transaction', async () => {
        const serialized = await buildSerializedTransaction(account, TX)
        const expected = getBase64EncodedWireTransaction(
          await buildSignedTransaction(account, TX)
        )

        const result = await account.sendTransaction(serialized)

        expect(result.hash).toBe(MOCK_SIGNATURE)
        expect(result.fee).toBe(BigInt(MOCK_FEE))
        expect(mockRpc.sendTransaction).toHaveBeenCalledWith(expected, {
          encoding: 'base64'
        })
      })

      it('should sign a base64-encoded serialized transaction without broadcasting', async () => {
        const serialized = await buildSerializedTransaction(account, TX)
        const expected = getBase64EncodedWireTransaction(
          await buildSignedTransaction(account, TX)
        )

        const signedTransaction = await account.signTransaction(serialized)

        expect(getBase64EncodedWireTransaction(signedTransaction)).toBe(expected)
        expect(mockRpc.sendTransaction).not.toHaveBeenCalled()
      })

      it('should quote a base64-encoded serialized transaction without broadcasting', async () => {
        const serialized = await buildSerializedTransaction(account, TX)
        const { messageBytes } = await buildSignedTransaction(account, TX)
        const expectedMessage = getBase64Decoder().decode(messageBytes)

        const { fee } = await account.quoteSendTransaction(serialized)

        expect(fee).toBe(BigInt(MOCK_FEE))
        expect(mockRpc.getFeeForMessage).toHaveBeenCalledWith(expectedMessage, {
          commitment: 'processed'
        })
        expect(mockRpc.sendTransaction).not.toHaveBeenCalled()
      })

      it('should throw if the serialized transaction fee payer does not match the account', async () => {
        const otherAccount = await wallet.getAccount(1)
        otherAccount._rpc = mockRpc

        const serialized = await buildSerializedTransaction(otherAccount, TX)

        await expect(account.sendTransaction(serialized)).rejects.toThrow(
          'does not match wallet address'
        )
        expect(mockRpc.sendTransaction).not.toHaveBeenCalled()
      })
    })

    describe('Fee Estimation', () => {
      it('should estimate and return transaction fee', async () => {
        mockRpc.getFeeForMessage.mockReturnValue({
          send: jest.fn().mockResolvedValue({ value: 7500 })
        })
        mockRpc.sendTransaction.mockReturnValue({
          send: jest.fn().mockResolvedValue(MOCK_SIGNATURE)
        })

        account._rpc = mockRpc

        const result = await account.sendTransaction(
          {
            to: OTHER_RECIPIENT_ADDRESS,
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
            to: OTHER_RECIPIENT_ADDRESS,
            value: 1000n
          })
        ).rejects.toThrow('Failed to calculate transaction fee')
      })
    })

    describe('Fee Limit', () => {
      it('should throw if transaction fee exceeds the transaction max fee configuration', async () => {
        mockRpc.getFeeForMessage.mockReturnValue({
          send: jest.fn().mockResolvedValue({ value: MOCK_FEE })
        })

        const limitedWallet = new WalletManagerSolana(TEST_SEED_PHRASE, {
          provider: TEST_RPC_URL,
          commitment: 'confirmed',
          transactionMaxFee: 0n
        })
        const limitedAccount = await limitedWallet.getAccount(0)

        limitedAccount._rpc = mockRpc

        await expect(
          limitedAccount.sendTransaction({
            to: RECIPIENT_ADDRESS,
            value: 1000000n
          })
        ).rejects.toThrow('Exceeded maximum fee cost for transaction operation.')
      })

      it('should allow a fee exactly equal to transactionMaxFee', async () => {
        mockRpc.getFeeForMessage.mockReturnValue({
          send: jest.fn().mockResolvedValue({ value: MOCK_FEE })
        })
        mockRpc.sendTransaction.mockReturnValue({
          send: jest.fn().mockResolvedValue(MOCK_SIGNATURE)
        })

        const limitedWallet = new WalletManagerSolana(TEST_SEED_PHRASE, {
          provider: TEST_RPC_URL,
          commitment: 'confirmed',
          transactionMaxFee: 5000n
        })
        const limitedAccount = await limitedWallet.getAccount(0)

        limitedAccount._rpc = mockRpc

        const result = await limitedAccount.sendTransaction(
          {
            to: RECIPIENT_ADDRESS,
            value: 1000000n
          },
          { skipConfirmation: true }
        )

        expect(result).toHaveProperty('hash')
      })

      it('should allow a fee below transactionMaxFee', async () => {
        mockRpc.getFeeForMessage.mockReturnValue({
          send: jest.fn().mockResolvedValue({ value: MOCK_FEE })
        })
        mockRpc.sendTransaction.mockReturnValue({
          send: jest.fn().mockResolvedValue(MOCK_SIGNATURE)
        })

        const limitedWallet = new WalletManagerSolana(TEST_SEED_PHRASE, {
          provider: TEST_RPC_URL,
          commitment: 'confirmed',
          transactionMaxFee: 5001n
        })
        const limitedAccount = await limitedWallet.getAccount(0)

        limitedAccount._rpc = mockRpc

        const result = await limitedAccount.sendTransaction(
          {
            to: RECIPIENT_ADDRESS,
            value: 1000000n
          },
          { skipConfirmation: true }
        )

        expect(result).toHaveProperty('hash')
      })
    })

    it('should broadcast an already-signed transaction', async () => {
      mockRpc.getFeeForMessage.mockReturnValue({
        send: jest.fn().mockResolvedValue({ value: MOCK_FEE })
      })
      mockRpc.sendTransaction.mockReturnValue({
        send: jest.fn().mockResolvedValue(MOCK_SIGNATURE)
      })

      account._rpc = mockRpc

      const signedTx = await buildSignedTransaction(account, {
        to: RECIPIENT_ADDRESS,
        value: 1000000n
      })

      const result = await account.sendTransaction(signedTx)

      expect(result.hash).toBe(MOCK_SIGNATURE)
      expect(result.fee).toBe(BigInt(MOCK_FEE))
      expect(mockRpc.sendTransaction).toHaveBeenCalledWith(
        getBase64EncodedWireTransaction(signedTx),
        { encoding: 'base64' }
      )
    })

    it('should throw if a signed transaction fee exceeds the transaction max fee configuration', async () => {
      mockRpc.getFeeForMessage.mockReturnValue({
        send: jest.fn().mockResolvedValue({ value: MOCK_FEE })
      })
      mockRpc.sendTransaction.mockReturnValue({
        send: jest.fn().mockResolvedValue(MOCK_SIGNATURE)
      })

      account._rpc = mockRpc

      const signedTx = await buildSignedTransaction(account, {
        to: RECIPIENT_ADDRESS,
        value: 1000000n
      })

      const limitedWallet = new WalletManagerSolana(TEST_SEED_PHRASE, {
        provider: TEST_RPC_URL,
        commitment: 'confirmed',
        transactionMaxFee: 0n
      })
      const limitedAccount = await limitedWallet.getAccount(0)

      limitedAccount._rpc = mockRpc

      await expect(
        limitedAccount.sendTransaction(signedTx)
      ).rejects.toThrow('Exceeded maximum fee cost for transaction operation.')
    })
  })

  describe('quoteSendTransaction', () => {
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
              blockhash: MOCK_BLOCKHASH,
              lastValidBlockHeight: MOCK_LAST_VALID_BLOCK_HEIGHT
            }
          })
        })
      }
    })

    afterEach(() => {
      account._rpc = originalRpc
    })

    it('should quote an already-signed transaction without broadcasting', async () => {
      mockRpc.getFeeForMessage.mockReturnValue({
        send: jest.fn().mockResolvedValue({ value: MOCK_FEE })
      })

      account._rpc = mockRpc

      const tx = {
        to: RECIPIENT_ADDRESS,
        value: 1000000n
      }

      const signedTx = await buildSignedTransaction(account, tx)

      const { fee: unsignedFee } = await account.quoteSendTransaction(tx)
      const { fee: signedFee } = await account.quoteSendTransaction(signedTx)

      expect(signedFee).toBe(unsignedFee)
      expect(signedFee).toBe(BigInt(MOCK_FEE))
    })
  })

  describe('signTransaction', () => {
    it('should sign a transaction and return the signed transaction', async () => {
      const mockRpc = {
        getFeeForMessage: jest.fn(),
        sendTransaction: jest.fn(),
        getLatestBlockhash: jest.fn().mockReturnValue({
          send: jest.fn().mockResolvedValue({
            value: {
              blockhash: MOCK_BLOCKHASH,
              lastValidBlockHeight: MOCK_LAST_VALID_BLOCK_HEIGHT
            }
          })
        })
      }

      const originalRpc = account._rpc
      account._rpc = mockRpc

      try {
        const TRANSACTION = {
          to: RECIPIENT_ADDRESS,
          value: 1000000n
        }

        const signedTx = await account.signTransaction(TRANSACTION)

        const decodedMessage = getCompiledTransactionMessageDecoder().decode(signedTx.messageBytes)

        expect(decodedMessage.staticAccounts).toContain(ACCOUNT_0.address)
        expect(decodedMessage.staticAccounts).toContain(TRANSACTION.to)

        // SystemProgram transfer instruction data: 4-byte LE discriminator (2) + 8-byte LE u64 lamports
        const { data } = decodedMessage.instructions[0]
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
        expect(view.getUint32(0, true)).toBe(2)
        expect(view.getBigUint64(4, true)).toBe(TRANSACTION.value)
        const payerSignature = signedTx.signatures[ACCOUNT_0.address]
        expect(payerSignature).toBeInstanceOf(Uint8Array)
        expect(payerSignature.length).toBe(64)
      } finally {
        account._rpc = originalRpc
      }
    })

    it('should throw if transaction fee exceeds the transaction max fee configuration', async () => {
      const mockRpc = {
        getFeeForMessage: jest.fn().mockReturnValue({
          send: jest.fn().mockResolvedValue({ value: MOCK_FEE })
        }),
        getLatestBlockhash: jest.fn().mockReturnValue({
          send: jest.fn().mockResolvedValue({
            value: {
              blockhash: MOCK_BLOCKHASH,
              lastValidBlockHeight: MOCK_LAST_VALID_BLOCK_HEIGHT
            }
          })
        })
      }

      const limitedWallet = new WalletManagerSolana(TEST_SEED_PHRASE, {
        provider: TEST_RPC_URL,
        commitment: 'confirmed',
        transactionMaxFee: 0n
      })
      const limitedAccount = await limitedWallet.getAccount(0)

      limitedAccount._rpc = mockRpc

      await expect(
        limitedAccount.signTransaction({
          to: RECIPIENT_ADDRESS,
          value: 1000000n
        })
      ).rejects.toThrow('Exceeded maximum fee cost for transaction operation.')
    })

    it('should allow a fee exactly equal to transactionMaxFee', async () => {
      const mockRpc = {
        getFeeForMessage: jest.fn().mockReturnValue({
          send: jest.fn().mockResolvedValue({ value: MOCK_FEE })
        }),
        getLatestBlockhash: jest.fn().mockReturnValue({
          send: jest.fn().mockResolvedValue({
            value: {
              blockhash: MOCK_BLOCKHASH,
              lastValidBlockHeight: MOCK_LAST_VALID_BLOCK_HEIGHT
            }
          })
        })
      }

      const limitedWallet = new WalletManagerSolana(TEST_SEED_PHRASE, {
        provider: TEST_RPC_URL,
        commitment: 'confirmed',
        transactionMaxFee: 5000n
      })
      const limitedAccount = await limitedWallet.getAccount(0)

      limitedAccount._rpc = mockRpc

      const signedTx = await limitedAccount.signTransaction({
        to: RECIPIENT_ADDRESS,
        value: 1000000n
      })

      expect(signedTx).toBeTruthy()
    })

    it('should allow a fee below transactionMaxFee', async () => {
      const mockRpc = {
        getFeeForMessage: jest.fn().mockReturnValue({
          send: jest.fn().mockResolvedValue({ value: MOCK_FEE })
        }),
        getLatestBlockhash: jest.fn().mockReturnValue({
          send: jest.fn().mockResolvedValue({
            value: {
              blockhash: MOCK_BLOCKHASH,
              lastValidBlockHeight: MOCK_LAST_VALID_BLOCK_HEIGHT
            }
          })
        })
      }

      const limitedWallet = new WalletManagerSolana(TEST_SEED_PHRASE, {
        provider: TEST_RPC_URL,
        commitment: 'confirmed',
        transactionMaxFee: 5001n
      })
      const limitedAccount = await limitedWallet.getAccount(0)

      limitedAccount._rpc = mockRpc

      const signedTx = await limitedAccount.signTransaction({
        to: RECIPIENT_ADDRESS,
        value: 1000000n
      })

      expect(signedTx).toBeTruthy()
    })

    it('should let the signers embedded in the transaction message sign alongside the account', async () => {
      const coSigner = await createKeyPairSignerFromPrivateKeyBytes(new Uint8Array(32).fill(1))

      let transactionMessage = createTransactionMessage({ version: 0 })
      transactionMessage = setTransactionMessageFeePayer(ACCOUNT_0.address, transactionMessage)
      transactionMessage = setTransactionMessageLifetimeUsingBlockhash({
        blockhash: MOCK_BLOCKHASH,
        lastValidBlockHeight: 1000000n
      }, transactionMessage)
      transactionMessage = appendTransactionMessageInstruction(getAddMemoInstruction({ memo: 'co-signed', signers: [coSigner] }), transactionMessage)

      const signedTx = await account.signTransaction(transactionMessage)

      const base58 = getBase58Decoder()
      expect(base58.decode(signedTx.signatures[ACCOUNT_0.address]))
        .toBe(COSIGNED_TRANSACTION_SIGNATURES.feePayer)
      expect(base58.decode(signedTx.signatures[coSigner.address]))
        .toBe(COSIGNED_TRANSACTION_SIGNATURES.cosigner)
    })

    it('should throw if the account is disposed', async () => {
      const signer = await new SeedSignerSolana(TEST_SEED_PHRASE).derive("0'/0'")
      const account = new WalletAccountSolana(signer, { provider: TEST_RPC_URL })

      account.dispose()

      await expect(account.signTransaction({ to: DUMMY_ADDRESS, value: 1000n }))
        .rejects.toThrow(new DisposalError('The wallet account has been disposed.'))
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
              blockhash: MOCK_BLOCKHASH,
              lastValidBlockHeight: MOCK_LAST_VALID_BLOCK_HEIGHT
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
            token: DUMMY_ADDRESS,
            recipient: DUMMY_ADDRESS,
            amount: 1000n
          })
        ).rejects.toThrow('The wallet must be connected to a provider')
      })

      it('should throw if account is disposed', async () => {
        const tempWallet = new WalletManagerSolana(TEST_SEED_PHRASE, {
          provider: TEST_RPC_URL,
          commitment: 'confirmed'
        })
        const tempAccount = await tempWallet.getAccount(89)

        tempAccount.dispose()

        await expect(
          tempAccount.transfer({
            token: DUMMY_ADDRESS,
            recipient: DUMMY_ADDRESS,
            amount: 1000n
          })
        ).rejects.toThrow(new DisposalError('The wallet account has been disposed.'))
      })

      it('should throw if amount exceeds u64 maximum', async () => {
        await expect(
          account.transfer({
            token: DUMMY_ADDRESS,
            recipient: DUMMY_ADDRESS,
            amount: 0xffffffffffffffffn + 1n
          })
        ).rejects.toThrow('Amount exceeds u64 maximum value')
      })

      it('should throw if number amount exceeds safe integer', async () => {
        await expect(
          account.transfer({
            token: DUMMY_ADDRESS,
            recipient: DUMMY_ADDRESS,
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
          send: jest.fn().mockResolvedValue({ value: MOCK_FEE })
        })
        mockRpc.sendTransaction.mockReturnValue({
          send: jest.fn().mockResolvedValue(MOCK_SIGNATURE)
        })

        account._rpc = mockRpc

        await account.transfer(
          {
            token: TOKEN_PROGRAM_ADDRESS,
            recipient: TOKEN_RECIPIENT_ADDRESS,
            amount: 1000000n
          },
          { skipConfirmation: true }
        )

        await account.transfer(
          {
            token: TOKEN_PROGRAM_ADDRESS,
            recipient: TOKEN_RECIPIENT_ADDRESS,
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
          provider: TEST_RPC_URL,
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
            token: TOKEN_PROGRAM_ADDRESS,
            recipient: TOKEN_RECIPIENT_ADDRESS,
            amount: 1000n
          })
        ).rejects.toThrow('Exceeded maximum fee cost')
      })

      it('should allow transfer if fee is below limit', async () => {
        const limitedWallet = new WalletManagerSolana(TEST_SEED_PHRASE, {
          provider: TEST_RPC_URL,
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
          send: jest.fn().mockResolvedValue({ value: MOCK_FEE })
        })
        mockRpc.sendTransaction.mockReturnValue({
          send: jest.fn().mockResolvedValue(MOCK_SIGNATURE)
        })

        limitedAccount._rpc = mockRpc

        const result = await limitedAccount.transfer(
          {
            token: TOKEN_PROGRAM_ADDRESS,
            recipient: TOKEN_RECIPIENT_ADDRESS,
            amount: 1000n
          },
          { skipConfirmation: true }
        )

        expect(result.hash).toBe(MOCK_SIGNATURE)
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
          send: jest.fn().mockResolvedValue({ value: MOCK_FEE })
        })
        mockRpc.sendTransaction.mockReturnValue({
          send: jest.fn().mockResolvedValue(MOCK_SIGNATURE)
        })

        account._rpc = mockRpc

        const result = await account.transfer(
          {
            token: USDT_MINT_ADDRESS,
            recipient: SYSTEM_PROGRAM_ADDRESS,
            amount: 1000000n
          },
          { skipConfirmation: true }
        )

        expect(result.hash).toBe(MOCK_SIGNATURE)
        expect(result.fee).toBe(BigInt(MOCK_FEE))
        expect(mockRpc.sendTransaction).toHaveBeenCalled()
      })

      it('should send an SPL token transfer carrying a memo', async () => {
        // 'wdk memo' encoded as UTF-8.
        const EXPECTED_MEMO_DATA = new Uint8Array([119, 100, 107, 32, 109, 101, 109, 111])

        const mintData = new Uint8Array(165)
        mockRpc.getAccountInfo.mockReturnValue({
          send: jest.fn().mockResolvedValue({
            value: { data: mintData }
          })
        })
        mockRpc.getFeeForMessage.mockReturnValue({
          send: jest.fn().mockResolvedValue({ value: MOCK_FEE })
        })
        mockRpc.sendTransaction.mockReturnValue({
          send: jest.fn().mockResolvedValue(MOCK_SIGNATURE)
        })

        account._rpc = mockRpc

        const result = await account.transfer(
          {
            token: USDT_MINT_ADDRESS,
            recipient: SYSTEM_PROGRAM_ADDRESS,
            amount: 1000000n
          },
          { memo: 'wdk memo' }
        )

        const [wireTransaction] = mockRpc.sendTransaction.mock.calls[0]
        const transaction = getTransactionDecoder()
          .decode(getBase64Encoder().encode(wireTransaction))
        const compiledMessage = getCompiledTransactionMessageDecoder()
          .decode(transaction.messageBytes)
        const programs = compiledMessage.instructions.map(
          (instruction) => compiledMessage.staticAccounts[instruction.programAddressIndex]
        )

        expect(programs).toEqual([MEMO_PROGRAM_ADDRESS, TOKEN_PROGRAM_ADDRESS])
        expect(compiledMessage.instructions[0].data).toEqual(EXPECTED_MEMO_DATA)
        expect(result.hash).toBe(MOCK_SIGNATURE)
        expect(result.fee).toBe(BigInt(MOCK_FEE))
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
