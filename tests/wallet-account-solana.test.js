import { confirmTestTransaction, createTestToken, getTransaction, sendCoinToIndexAccount } from './tokenBasic.js'
import WalletAccountSolana from '../src/wallet-account-solana.js'
import * as bip39 from 'bip39'
const SEED_PHRASE = 'cook voyage document eight skate token alien guide drink uncle term abuse'

const VALID_SEED = bip39.mnemonicToSeedSync(SEED_PHRASE)
const VALID_PATH = "0'/0/0" // BIP-44 path for Solana accounts
const VALID_CONFIG = { rpcUrl: 'http://localhost:8899', wsUrl: 'ws://localhost:8900' } // Use solana-test-validator RPC
const VALID_ADDRESS = '7YKHgGWWGgFZMS87Unxyzog4nGWhAwGzfr7SxbPcuskv'
const TO_ADDRESS = '6m69wRwfLiKxgfvfcTuHs7dxfL4jCjBWdc9dQWUTcn19'
const INVALID_SEED_PHRASE = 'invalid seed phrase'
const INDEX_1_ACCOUNT_PATH = "0'/0/1"

const ACCOUNT = {
  index: 0,
  path: "m/44'/501'/0'/0/0",
  address: '7YKHgGWWGgFZMS87Unxyzog4nGWhAwGzfr7SxbPcuskv',
  keyPair: {
    privateKey: '03d2ef9708f8e5d23ee50dd93b435da3cb1d3470b9a85a41e3697e3806a1a75d612bcdee8a0a93d631d901484b2e40373ddbd783e17f58ad9e486bd5f77d3f0b',
    publicKey: '612bcdee8a0a93d631d901484b2e40373ddbd783e17f58ad9e486bd5f77d3f0b'
  }
}

describe('WalletAccountSolana', () => {
  let account
  let VALID_TOKEN
  beforeAll(async () => {
    const tokenMint = await createTestToken(SEED_PHRASE)
    if (!tokenMint) {
      throw new Error('Failed to create test token')
    }
    VALID_TOKEN = tokenMint
  })

  beforeEach(async () => {
    account = await WalletAccountSolana.create(VALID_SEED, VALID_PATH, VALID_CONFIG)
  })

  afterEach(() => {
    account?.dispose()
  })

  describe('create', () => {
    test('should successfully initialize an account for the given seed phrase and path', async () => {
      const account = await WalletAccountSolana.create(SEED_PHRASE, VALID_PATH)

      expect(account.index).toBe(ACCOUNT.index)

      expect(account.path).toBe(ACCOUNT.path)

      expect(account.keyPair).toEqual({
        privateKey: new Uint8Array(Buffer.from(ACCOUNT.keyPair.privateKey, 'hex')),
        publicKey: new Uint8Array(Buffer.from(ACCOUNT.keyPair.publicKey, 'hex'))
      }
      )
    })

    test('should successfully initialize an account for the given seed and path', async () => {
      const account = await WalletAccountSolana.create(VALID_SEED, VALID_PATH)

      expect(account.index).toBe(ACCOUNT.index)

      expect(account.path).toBe(ACCOUNT.path)

      expect(account.keyPair).toEqual({
        privateKey: new Uint8Array(Buffer.from(ACCOUNT.keyPair.privateKey, 'hex')),
        publicKey: new Uint8Array(Buffer.from(ACCOUNT.keyPair.publicKey, 'hex'))
      })
    })

    test('should throw if the seed phrase is invalid', async () => {
      await expect(WalletAccountSolana.create(INVALID_SEED_PHRASE, VALID_PATH)).rejects
        .toThrow('The seed phrase is invalid.')
    })

    test('should throw if the path is invalid', async () => {
      await expect(WalletAccountSolana.create(SEED_PHRASE, "a'/b")).rejects
        .toThrow('Invalid child index: a')
    })
  })

  describe('getAddress', () => {
    test('should return the correct address', async () => {
      const address = await account.getAddress()
      expect(address).toBe(ACCOUNT.address)
    })
  })

  describe('sign', () => {
    const MESSAGE = 'Dummy message to sign.'

    const EXPECTED_SIGNATURE = 'ce5c456edf29423e85a7a7f06150cb5bfd282c8771d7b7107f8eab94ecae1960e6cbf0487f63102590c90e076e3f6e74e8745213da152577b1278a12dd0df800'

    test('should return the correct signature', async () => {
      const signature = await account.sign(MESSAGE)

      expect(signature).toBe(EXPECTED_SIGNATURE)
    })
  })

  describe('verify', () => {
    const MESSAGE = 'Dummy message to sign.'

    const SIGNATURE = 'ce5c456edf29423e85a7a7f06150cb5bfd282c8771d7b7107f8eab94ecae1960e6cbf0487f63102590c90e076e3f6e74e8745213da152577b1278a12dd0df800'

    test('should return true for a valid signature', async () => {
      const result = await account.verify(MESSAGE, SIGNATURE)

      expect(result).toBe(true)
    })

    test('should return false for an invalid signature', async () => {
      const result = await account.verify('Another message.', SIGNATURE)
      expect(result).toBe(false)
    })
  })

  describe('sendTransaction', () => {
    const TRANSACTION = { to: TO_ADDRESS, value: 1000000 }

    test('should successfully send a transaction', async () => {
      const txResult = await account.sendTransaction(TRANSACTION)
      expect(txResult).toBeDefined()
      await confirmTestTransaction(txResult.hash)
      const tx = await getTransaction(txResult.hash)
      expect(tx.transaction.signatures[0]).toEqual(txResult.hash)
      const txDetails = tx.transaction.message.instructions[0].parsed.info
      expect(txDetails.destination).toEqual(TO_ADDRESS)
      expect(txDetails.lamports).toEqual(TRANSACTION.value)
    })

    test('should throw error when sending transaction with invalid rpc', async () => {
      const walletWithoutRpc = new WalletAccountSolana(VALID_SEED, VALID_PATH)
      await expect(walletWithoutRpc.sendTransaction(TRANSACTION)).rejects.toThrow('The wallet must be connected to a provider to send transactions.')
    })
  })

  describe('quoteTransaction', () => {
    const TRANSACTION = { to: TO_ADDRESS, value: 1000000 }
    const EXPECTED_FEE = 5000
    test('should successfully quote a transaction', async () => {
      const quote = await account.quoteSendTransaction(TRANSACTION)
      expect(quote.fee).toEqual(EXPECTED_FEE)
    })

    test('should throw error when quoting transaction with invalid address', async () => {
      const tx = { to: 'invalid', value: 1000000 }
      await expect(account.quoteSendTransaction(tx)).rejects.toThrow()
    })

    test('should throw error when quoting transaction with invalid rpc', async () => {
      const walletWithoutRpc = new WalletAccountSolana(VALID_SEED, VALID_PATH)
      await expect(walletWithoutRpc.quoteSendTransaction(TRANSACTION)).rejects.toThrow('The wallet must be connected to a provider to quote transactions.')
    })
  })

  describe('getBalance', () => {
    test('should get wallet balance', async () => {
      await sendCoinToIndexAccount(SEED_PHRASE, 1)

      const account = await WalletAccountSolana.create(VALID_SEED, INDEX_1_ACCOUNT_PATH, VALID_CONFIG)

      const balance = await account.getBalance()
      expect(balance).toBeGreaterThanOrEqual(1000000000)
    })

    test('should throw error when getting balance without RPC', async () => {
      const walletWithoutRpc = new WalletAccountSolana(VALID_SEED, VALID_PATH)
      await expect(walletWithoutRpc.getBalance()).rejects.toThrow('The wallet must be connected to a provider to retrieve balances.')
    })
  })

  describe('getTokenBalance', () => {
    test('should return the correct token balance of the account', async () => {
      const tokenAccount = await WalletAccountSolana.create(VALID_SEED, INDEX_1_ACCOUNT_PATH, VALID_CONFIG)

      const TOKEN_TRANSACTION = { recipient: TO_ADDRESS, token: VALID_TOKEN, amount: 200 }
      const txResult = await account.transfer(TOKEN_TRANSACTION)

      await confirmTestTransaction(txResult.hash)

      const balance = await tokenAccount.getTokenBalance(VALID_TOKEN)
      expect(balance).toBe(200)
    })

    test('should throw error when getting token balance without RPC', async () => {
      const walletWithoutRpc = new WalletAccountSolana(VALID_SEED, VALID_PATH)
      await expect(walletWithoutRpc.getTokenBalance(VALID_TOKEN)).rejects.toThrow('rpcUrl is required to retrieve token balances.')
    })

    test('should throw error for invalid token address', async () => {
      await expect(account.getTokenBalance('invalid-token')).rejects.toThrow('Non-base58 character')
    })
  })

  describe('quoteTransfer', () => {
    test('should return fee for token transfer', async () => {
      const TOKEN_TRANSACTION = { recipient: TO_ADDRESS, token: VALID_TOKEN, amount: 10 }

      const quote = await account.quoteTransfer(TOKEN_TRANSACTION)
      expect(quote.fee).toBe(5000)
    })
  })

  describe('transfer', () => {
    test('should send token transaction', async () => {
      const TOKEN_TRANSACTION = { recipient: TO_ADDRESS, token: VALID_TOKEN, amount: 100 }

      const txResult = await account.transfer(TOKEN_TRANSACTION)
      expect(txResult).toBeDefined()

      await confirmTestTransaction(txResult.hash)

      const tx = await getTransaction(txResult.hash)
      const txDetails = tx.transaction.message.instructions[0].parsed.info
      expect(txDetails.authority).toEqual(ACCOUNT.address)
      expect(txDetails.amount).toEqual(TOKEN_TRANSACTION.amount.toString())
      expect(tx.transaction.signatures[0]).toEqual(txResult.hash)

      const balance = await account.getTokenBalance(VALID_TOKEN)

      // Out of 1000 tokens, 200 token sent to index 1 account, 100 in this test
      expect(balance).toBe(9700)
    })

    test('should throw program id error when sending invalid token transaction', async () => {
      const params = { recipient: VALID_ADDRESS, token: '9gT8yrFzG7e23NE4hRGMoPPBuaNjVKnp8pdH7HkjJnY3', amount: 1000000 }
      await expect(account.transfer(params)).rejects.toThrow('Failed to find account')
    })

    test('should handle token transaction errors', async () => {
      const params = { recipient: 'invalid', token: VALID_TOKEN, amount: 1000000 }
      await expect(account.transfer(params)).rejects.toThrow()
    })
  })

  describe('getTransactionReceipt', () => {
    test('should get transaction receipt by signature', async () => {
      const TRANSACTION = { to: TO_ADDRESS, value: 1000000 }
      const txResult = await account.sendTransaction(TRANSACTION)
      expect(txResult).toBeDefined()
      await confirmTestTransaction(txResult.hash)
      const tx = await account.getTransactionReceipt(txResult.hash)
      expect(tx.transaction.signatures[0]).toEqual(txResult.hash)
      expect(tx.transaction.message.instructions.length).toEqual(1)
    })

    test('should return null if transaction not found', async () => {
      const signature = '5D517Q8FrU2chRUtmssRmXsrjSZEiyk6HajBKiPqZfakCKkZifGJiJKMTumsrRACnD3N7mVM2Kpk1KFciNB14oEm'
      const tx = await account.getTransactionReceipt(signature)
      expect(tx).toEqual(null)
    })
  })
})
