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

import { spawn } from 'child_process'
import { describe, expect, test, beforeEach, afterEach, jest } from '@jest/globals'

import { address } from '@solana/addresses'
import {
  createSolanaRpcSubscriptions,
  sendAndConfirmTransactionFactory
} from '@solana/kit'
import {
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstruction,
  getInitializeMintInstruction,
  getMintSize,
  getMintToInstruction,
  TOKEN_PROGRAM_ADDRESS
} from '@solana-program/token'
import { getCreateAccountInstruction } from '@solana-program/system'
import { createSolanaRpc } from '@solana/rpc'
import {
  generateKeyPairSigner,
  setTransactionMessageFeePayerSigner,
  signTransactionMessageWithSigners
} from '@solana/signers'
import {
  appendTransactionMessageInstructions,
  createTransactionMessage,
  setTransactionMessageLifetimeUsingBlockhash
} from '@solana/transaction-messages'
import { pipe } from '@solana/functional'

import WalletManagerSolana from '@tetherto/wdk-wallet-solana'

jest.setTimeout(30_000)

const SEED_PHRASE = 'test walk nut penalty hip pave soap entry language right filter choice'
const TEST_RPC_URL = 'http://127.0.0.1:8899'
const TEST_RPC_SUBSCRIPTIONS_URL = 'ws://127.0.0.1:8900'

const ACCOUNT_0 = {
  index: 0,
  path: "m/44'/501'/0'/0'",
  address: '3uXqWpwgqKVdiHAwF6Vmu4G4vdQzpR66xjPkz1G7zMKE',
  keyPair: {
    privateKey: 'de705bcaa34a2ea50c0b7e6e584006f2458652fa9d6e20994ac146852490c76f',
    publicKey: '2b2c715c2cf24db57e95a44df34cb424de2460e86c4f6ebe7ba62b574830de19'
  }
}

const ACCOUNT_1 = {
  index: 1,
  path: "m/44'/501'/1'/0'",
  address: 'CfGcujEkPVDx7yGyn1PUjxn2e353MXbLk8ixzwuJUktK',
  keyPair: {
    privateKey: '4642fc818f6525a2c5ae784cc98f44d639492c21271c5f7f0ac30ee95a3357bb',
    publicKey: 'ad3e499bc158a797574c53bcca546939f0de16242b85ed39a848092c4d9d5274'
  }
}

const INITIAL_BALANCE = 1_000_000_000n
const INITIAL_TOKEN_BALANCE = 1_000_000n
const TEST_TOKEN_DECIMALS = 6
const TEST_RECIPIENT_ADDRESS = 'Hsg1peob7yZNwaBAbaqKjNBkX1zgiyKpPELec1jQofem'

/**
 * @param {ReturnType<typeof createSolanaRpc>} rpc
 * @param {string} signature
 * @param {'confirmed' | 'finalized'} [commitment]
 * @returns {Promise<boolean>}
 */
async function confirmTransaction (rpc, signature, commitment = 'confirmed') {
  for (let attempt = 0; attempt < 40; attempt++) {
    const { value: [status] } = await rpc.getSignatureStatuses([signature]).send()

    if (status?.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`)
    }

    if (
      status?.confirmationStatus === commitment ||
      (commitment === 'confirmed' && status?.confirmationStatus === 'finalized')
    ) {
      return true
    }

    await new Promise(resolve => setTimeout(resolve, 250))
  }

  return false
}

/**
 * @param {import('@tetherto/wdk-wallet-solana').WalletAccountSolana} account
 * @param {string} hash
 * @returns {Promise<import('@tetherto/wdk-wallet-solana').SolanaTransactionReceipt>}
 */
async function getTransactionReceipt (account, hash) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const receipt = await account.getTransactionReceipt(hash)

    if (receipt) {
      return receipt
    }

    await new Promise(resolve => setTimeout(resolve, 250))
  }

  throw new Error(`Transaction receipt was not available: ${hash}`)
}

/**
 * @param {ReturnType<typeof createSolanaRpc>} rpc
 * @returns {Promise<() => Promise<void>>}
 */
async function startSolanaTestValidator (rpc) {
  const validatorProcess = spawn('solana-test-validator', ['--reset'], {
    stdio: ['ignore', 'ignore', 'ignore']
  })

  let startupError
  const closed = new Promise(resolve => {
    validatorProcess.once('close', resolve)
  })

  validatorProcess.once('error', (error) => {
    startupError = error
  })

  const stopSolanaTestValidator = async () => {
    if (!validatorProcess.killed && validatorProcess.exitCode === null) {
      validatorProcess.kill('SIGKILL')
    }

    await closed
  }

  for (let attempt = 0; attempt < 10; attempt++) {
    if (startupError) {
      await stopSolanaTestValidator()
      throw startupError
    }

    try {
      await rpc.getLatestBlockhash({ commitment: 'confirmed' }).send()
      return stopSolanaTestValidator
    } catch {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  await stopSolanaTestValidator()
  throw new Error(`RPC was not ready at ${TEST_RPC_URL}`)
}

/**
 * @param {ReturnType<typeof createSolanaRpc>} rpc
 * @param {ReturnType<typeof sendAndConfirmTransactionFactory>} sendAndConfirmTransaction
 * @returns {Promise<{ mint: string, mintAuthority: import('@solana/signers').KeyPairSigner }>}
 */
async function deployTestToken (rpc, sendAndConfirmTransaction) {
  const mintAuthority = await generateKeyPairSigner()
  const airdropSignature = await rpc
    .requestAirdrop(address(mintAuthority.address), INITIAL_BALANCE, { commitment: 'confirmed' })
    .send()
  const airdropConfirmed = await confirmTransaction(rpc, airdropSignature)

  if (!airdropConfirmed) {
    throw new Error(`Airdrop transaction was not confirmed: ${airdropSignature}`)
  }

  const mintSigner = await generateKeyPairSigner()
  const mint = address(mintSigner.address)
  const mintRent = await rpc
    .getMinimumBalanceForRentExemption(BigInt(getMintSize()), { commitment: 'confirmed' })
    .send()

  const { value: latestBlockhash } = await rpc.getLatestBlockhash({ commitment: 'confirmed' }).send()
  const transactionMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayerSigner(mintAuthority, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx) => appendTransactionMessageInstructions([
      getCreateAccountInstruction({
        payer: mintAuthority,
        newAccount: mintSigner,
        lamports: mintRent,
        space: BigInt(getMintSize()),
        programAddress: TOKEN_PROGRAM_ADDRESS
      }),
      getInitializeMintInstruction({
        mint,
        decimals: TEST_TOKEN_DECIMALS,
        mintAuthority: mintAuthority.address,
        freezeAuthority: mintAuthority.address
      })
    ], tx)
  )
  const signedTransaction = await signTransactionMessageWithSigners(transactionMessage)
  await sendAndConfirmTransaction(signedTransaction, { commitment: 'confirmed' })

  return { mint, mintAuthority }
}

describe('@tetherto/wdk-wallet-solana', () => {
  const rpc = createSolanaRpc(TEST_RPC_URL)
  const rpcSubscriptions = createSolanaRpcSubscriptions(TEST_RPC_SUBSCRIPTIONS_URL)
  const sendAndConfirmTransaction = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions })

  let stopSolanaTestValidator
  let testToken
  let wallet

  async function sendSolsTo (to, value) {
    const signature = await rpc.requestAirdrop(address(to), value, { commitment: 'confirmed' }).send()
    const confirmed = await confirmTransaction(rpc, signature)

    if (!confirmed) {
      throw new Error(`Airdrop transaction was not confirmed: ${signature}`)
    }
  }

  async function sendTestTokensTo (to, value) {
    const owner = address(to)
    const [ata] = await findAssociatedTokenPda({
      mint: testToken.mint,
      owner,
      tokenProgram: TOKEN_PROGRAM_ADDRESS
    })

    const { value: latestBlockhash } = await rpc.getLatestBlockhash({ commitment: 'confirmed' }).send()
    const transactionMessage = pipe(
      createTransactionMessage({ version: 0 }),
      (tx) => setTransactionMessageFeePayerSigner(testToken.mintAuthority, tx),
      (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
      (tx) => appendTransactionMessageInstructions([
        getCreateAssociatedTokenIdempotentInstruction({
          payer: testToken.mintAuthority.address,
          ata,
          owner,
          mint: testToken.mint
        }),
        getMintToInstruction({
          mint: testToken.mint,
          token: ata,
          mintAuthority: testToken.mintAuthority,
          amount: value
        })
      ], tx)
    )
    const signedTransaction = await signTransactionMessageWithSigners(transactionMessage)
    await sendAndConfirmTransaction(signedTransaction, { commitment: 'confirmed' })
  }

  beforeEach(async () => {
    stopSolanaTestValidator = await startSolanaTestValidator(rpc)
    testToken = await deployTestToken(rpc, sendAndConfirmTransaction)

    for (const account of [ACCOUNT_0, ACCOUNT_1]) {
      await sendSolsTo(account.address, INITIAL_BALANCE)

      await sendTestTokensTo(account.address, INITIAL_TOKEN_BALANCE)
    }

    wallet = new WalletManagerSolana(SEED_PHRASE, { rpcUrl: TEST_RPC_URL })
  })

  afterEach(async () => {
    if (stopSolanaTestValidator) {
      await stopSolanaTestValidator()
      stopSolanaTestValidator = undefined
    }
  })

  test('should derive an account, quote the cost of a tx and send the tx', async () => {
    const account = await wallet.getAccount(0)

    const TRANSACTION = { to: ACCOUNT_1.address, value: 1_000 }

    const EXPECTED_FEE = 5000n

    const { fee: feeEstimate } = await account.quoteSendTransaction(TRANSACTION)

    expect(feeEstimate).toBe(EXPECTED_FEE)

    const { hash, fee } = await account.sendTransaction(TRANSACTION)
    await confirmTransaction(rpc, hash, 'finalized')
    const receipt = await getTransactionReceipt(account, hash)

    expect(receipt.transaction.signatures).toContain(hash)
    expect(receipt.meta.err).toBeNull()
    expect(fee).toBe(feeEstimate)
  })

  test('should derive two accounts, send a tx from account 1 to 2 and get the correct balances', async () => {
    const account0 = await wallet.getAccount(0)

    const account1 = await wallet.getAccount(1)

    const TRANSACTION = {
      to: await account1.getAddress(),
      value: 1_000
    }

    const balanceAccount0Before = await account0.getBalance()
    const balanceAccount1Before = await account1.getBalance()

    const { hash } = await account0.sendTransaction(TRANSACTION)
    await confirmTransaction(rpc, hash, 'finalized')
    const receipt = await getTransactionReceipt(account0, hash)

    const balanceAccount0 = await account0.getBalance()
    const balanceAccount1 = await account1.getBalance()

    expect(balanceAccount0).toBe(balanceAccount0Before - BigInt(receipt.meta.fee) - 1_000n)
    expect(balanceAccount1).toBe(balanceAccount1Before + 1_000n)
  })

  test('should derive an account by its path, quote the cost of transferring a token and transfer a token', async () => {
    const account = await wallet.getAccountByPath("0'/0'")

    const TRANSFER = {
      token: testToken.mint,
      recipient: TEST_RECIPIENT_ADDRESS,
      amount: 100
    }

    const EXPECTED_FEE = 5000n

    const { fee: feeEstimate } = await account.quoteTransfer(TRANSFER)

    expect(feeEstimate).toBe(EXPECTED_FEE)

    const { hash, fee } = await account.transfer(TRANSFER)
    await confirmTransaction(rpc, hash, 'finalized')
    const receipt = await getTransactionReceipt(account, hash)

    expect(receipt.transaction.signatures).toContain(hash)
    expect(receipt.meta.err).toBeNull()
    expect(fee).toBe(feeEstimate)
  })

  test('should derive two accounts by their paths, transfer a token from account 1 to 2 and get the correct balances and token balances', async () => {
    const account0 = await wallet.getAccountByPath("0'/0'")
    const account1 = await wallet.getAccountByPath("1'/0'")

    const TRANSFER = {
      token: testToken.mint,
      recipient: await account1.getAddress(),
      amount: 100
    }

    const balanceAccount0Before = await account0.getBalance()

    const { hash } = await account0.transfer(TRANSFER)
    await confirmTransaction(rpc, hash, 'finalized')
    const receipt = await getTransactionReceipt(account0, hash)

    const balanceAccount0 = await account0.getBalance()

    expect(balanceAccount0).toBe(balanceAccount0Before - BigInt(receipt.meta.fee))

    const tokenBalanceAccount0 = await account0.getTokenBalance(testToken.mint)
    const tokenBalanceAccount1 = await account1.getTokenBalance(testToken.mint)

    expect(tokenBalanceAccount0).toBe(INITIAL_TOKEN_BALANCE - 100n)
    expect(tokenBalanceAccount1).toBe(INITIAL_TOKEN_BALANCE + 100n)
  })

  test('should derive an account, sign a message and verify its signature', async () => {
    const account = await wallet.getAccount(0)

    const MESSAGE = 'Hello, world!'

    const signature = await account.sign(MESSAGE)
    const isValid = await account.verify(MESSAGE, signature)
    expect(isValid).toBe(true)
  })

  test('should dispose the wallet and erase the private keys of the accounts', async () => {
    const account0 = await wallet.getAccount(0)

    const account1 = await wallet.getAccount(1)

    wallet.dispose()

    const MESSAGE = 'Hello, world!'

    const TRANSACTION = {
      to: TEST_RECIPIENT_ADDRESS,
      value: 1_000
    }

    const TRANSFER = {
      token: TEST_RECIPIENT_ADDRESS,
      recipient: TEST_RECIPIENT_ADDRESS,
      amount: 100
    }

    for (const account of [account0, account1]) {
      expect(account.keyPair.privateKey).toBe(undefined)

      await expect(account.sign(MESSAGE)).rejects.toThrow('The wallet account has been disposed.')
      await expect(account.sendTransaction(TRANSACTION)).rejects.toThrow('The wallet account has been disposed.')
      await expect(account.transfer(TRANSFER)).rejects.toThrow('The wallet account has been disposed.')
    }
  })

  test('should create a wallet with a low transfer max fee, derive an account, try to transfer some tokens and gracefully fail', async () => {
    const wallet = new WalletManagerSolana(SEED_PHRASE, {
      rpcUrl: TEST_RPC_URL,
      transferMaxFee: 0
    })

    const account = await wallet.getAccount(0)

    const TRANSFER = {
      token: testToken.mint,
      recipient: TEST_RECIPIENT_ADDRESS,
      amount: 100
    }

    await expect(account.transfer(TRANSFER))
      .rejects.toThrow('Exceeded maximum fee cost for transfer operation.')
  })
})
