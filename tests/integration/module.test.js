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
import {
  AccountState,
  ExtensionType,
  findAssociatedTokenPda as findAssociatedToken2022Pda,
  getCreateAssociatedTokenIdempotentInstruction as getCreateAssociatedToken2022IdempotentInstruction,
  getEnableMemoTransfersInstruction,
  getFreezeAccountInstruction,
  getInitializeMint2Instruction,
  getMintSize as getMint2022Size,
  getMintToInstruction as getMintTo2022Instruction,
  getPostInitializeInstructionsForMintExtensions,
  getPreInitializeInstructionsForMintExtensions,
  getReallocateInstruction,
  getThawAccountInstruction,
  TOKEN_2022_PROGRAM_ADDRESS
} from '@solana-program/token-2022'
import { getCreateAccountInstruction, getTransferSolInstruction } from '@solana-program/system'
import { createSolanaRpc } from '@solana/rpc'
import {
  createNoopSigner,
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

import WalletManagerSolana, {
  ConfidentialTransferNotSupportedError,
  FrozenTokenAccountError,
  NonTransferableTokenError,
  TransferHookNotSupportedError,
  WalletAccountReadOnlySolana
} from '@tetherto/wdk-wallet-solana'

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
 * @returns {Promise<void>}
 */
async function confirmTransaction (rpc, signature) {
  for (let attempt = 0; attempt < 15; attempt++) {
    const { value: [status] } = await rpc.getSignatureStatuses([signature]).send()

    if (status?.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`)
    }

    if (['confirmed', 'finalized'].includes(status?.confirmationStatus)) {
      return
    }

    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  throw new Error(`Transaction was not confirmed after several attempts: ${signature}`)
}

/**
 * @param {ReturnType<typeof createSolanaRpc>} rpc
 * @returns {Promise<() => Promise<void>>}
 */
async function startSolanaTestValidator (rpc) {
  const validatorProcess = spawn('solana-test-validator', ['--reset', '--ticks-per-slot', '4'], {
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
  await confirmTransaction(rpc, airdropSignature)

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

/**
 * @param {ReturnType<typeof sendAndConfirmTransactionFactory>} sendAndConfirmTransaction
 * @param {ReturnType<typeof createSolanaRpc>} rpc
 * @param {import('@solana/signers').KeyPairSigner} feePayer
 * @param {import('@solana/kit').Instruction[]} instructions
 * @returns {Promise<void>}
 */
async function sendInstructions (sendAndConfirmTransaction, rpc, feePayer, instructions) {
  const { value: latestBlockhash } = await rpc.getLatestBlockhash({ commitment: 'confirmed' }).send()
  const transactionMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayerSigner(feePayer, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx) => appendTransactionMessageInstructions(instructions, tx)
  )
  const signedTransaction = await signTransactionMessageWithSigners(transactionMessage)
  await sendAndConfirmTransaction(signedTransaction, { commitment: 'confirmed' })
}

/**
 * @param {ReturnType<typeof createSolanaRpc>} rpc
 * @param {ReturnType<typeof sendAndConfirmTransactionFactory>} sendAndConfirmTransaction
 * @param {import('@solana-program/token-2022').ExtensionArgs[]} [extensions]
 * @returns {Promise<{ mint: string, mintAuthority: import('@solana/signers').KeyPairSigner }>}
 */
async function deployTestToken2022 (rpc, sendAndConfirmTransaction, extensions = []) {
  const mintAuthority = await generateKeyPairSigner()
  const airdropSignature = await rpc
    .requestAirdrop(address(mintAuthority.address), INITIAL_BALANCE, { commitment: 'confirmed' })
    .send()
  await confirmTransaction(rpc, airdropSignature)

  const mintSigner = await generateKeyPairSigner()
  const mint = address(mintSigner.address)
  // An empty list would size the account for an extension suffix, which a bare mint does not have.
  const space = getMint2022Size(extensions.length > 0 ? extensions : undefined)
  const mintRent = await rpc
    .getMinimumBalanceForRentExemption(BigInt(space), { commitment: 'confirmed' })
    .send()

  await sendInstructions(sendAndConfirmTransaction, rpc, mintAuthority, [
    getCreateAccountInstruction({
      payer: mintAuthority,
      newAccount: mintSigner,
      lamports: mintRent,
      space: BigInt(space),
      programAddress: TOKEN_2022_PROGRAM_ADDRESS
    }),
    ...getPreInitializeInstructionsForMintExtensions(mint, extensions),
    getInitializeMint2Instruction({
      mint,
      decimals: TEST_TOKEN_DECIMALS,
      mintAuthority: mintAuthority.address,
      freezeAuthority: mintAuthority.address
    }),
    ...getPostInitializeInstructionsForMintExtensions(mint, mintAuthority, extensions)
  ])

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
    await confirmTransaction(rpc, signature)
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
          payer: testToken.mintAuthority,
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

    wallet = new WalletManagerSolana(SEED_PHRASE, { provider: TEST_RPC_URL })
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
    await confirmTransaction(rpc, hash)
    const receipt = await account.getTransactionReceipt(hash)

    expect(receipt.transaction.signatures).toContain(hash)
    expect(receipt.meta.err).toBeNull()
    expect(fee).toBe(feeEstimate)
  })

  test('should derive an account, sign a transaction and broadcast the resulting signed transaction', async () => {
    const account = await wallet.getAccount(0)

    const TRANSACTION = { to: ACCOUNT_1.address, value: 1_000 }

    const signedTx = await account.signTransaction(TRANSACTION)

    const { hash } = await account.sendTransaction(signedTx)
    await confirmTransaction(rpc, hash)
    const receipt = await account.getTransactionReceipt(hash)

    expect(receipt.transaction.signatures).toContain(hash)
    expect(receipt.meta.err).toBeNull()
  })

  test('should derive an account, sign a transaction and quote the resulting signed transaction without broadcasting', async () => {
    const account = await wallet.getAccount(0)

    const TRANSACTION = { to: ACCOUNT_1.address, value: 1_000 }

    const signedTx = await account.signTransaction(TRANSACTION)

    const { fee } = await account.quoteSendTransaction(signedTx)

    expect(fee).toBe(5000n)
  })

  test('should send a transaction message carrying a placeholder signer for the account address', async () => {
    const account0 = await wallet.getAccount(0)
    const account1 = await wallet.getAccount(1)

    const TRANSACTION_MESSAGE = appendTransactionMessageInstructions([
      getTransferSolInstruction({
        source: createNoopSigner(address(ACCOUNT_0.address)),
        destination: address(ACCOUNT_1.address),
        amount: 1_000n
      })
    ], createTransactionMessage({ version: 0 }))

    const balanceAccount0Before = await account0.getBalance()
    const balanceAccount1Before = await account1.getBalance()

    const { hash, fee } = await account0.sendTransaction(TRANSACTION_MESSAGE)
    await confirmTransaction(rpc, hash)
    const receipt = await account0.getTransaction(hash)

    expect(receipt.success).toBe(true)
    expect(fee).toBe(5000n)
    expect(await account0.getBalance()).toBe(balanceAccount0Before - fee - 1_000n)
    expect(await account1.getBalance()).toBe(balanceAccount1Before + 1_000n)
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
    await confirmTransaction(rpc, hash)
    const receipt = await account0.getTransactionReceipt(hash)

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
    await confirmTransaction(rpc, hash)
    const receipt = await account.getTransactionReceipt(hash)

    expect(receipt.transaction.signatures).toContain(hash)
    expect(receipt.meta.err).toBeNull()
    expect(fee).toBe(feeEstimate)
  })

  test('should derive an account by its path and transfer a token attaching a memo', async () => {
    const account = await wallet.getAccountByPath("0'/0'")

    const TRANSFER = {
      token: testToken.mint,
      recipient: TEST_RECIPIENT_ADDRESS,
      amount: 100
    }

    const SOLANA_OPTIONS = { memo: 'wdk memo' }

    const EXPECTED_MEMO_LOG = 'Program log: Memo (len 8): "wdk memo"'

    const tokenBalanceBefore = await account.getTokenBalance(testToken.mint)

    const { hash, fee } = await account.transfer(TRANSFER, SOLANA_OPTIONS)
    await confirmTransaction(rpc, hash)
    const receipt = await account.getTransaction(hash)

    const tokenBalance = await account.getTokenBalance(testToken.mint)

    expect(receipt.success).toBe(true)
    expect(receipt.fee).toBe(fee)
    expect(receipt.transaction.meta.logMessages).toContain(EXPECTED_MEMO_LOG)
    expect(tokenBalance).toBe(tokenBalanceBefore - 100n)
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
    await confirmTransaction(rpc, hash)
    const receipt = await account0.getTransactionReceipt(hash)

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
      token: testToken.mint,
      recipient: TEST_RECIPIENT_ADDRESS,
      amount: 100
    }

    for (const account of [account0, account1]) {
      expect(account.keyPair.privateKey).toBeNull()

      await expect(account.sign(MESSAGE)).rejects.toThrow('The wallet account has been disposed.')
      await expect(account.sendTransaction(TRANSACTION)).rejects.toThrow('The wallet account has been disposed.')
      await expect(account.transfer(TRANSFER)).rejects.toThrow('The wallet account has been disposed.')
    }
  })

  test('should create a wallet with a low transfer max fee, derive an account, try to transfer some tokens and gracefully fail', async () => {
    const wallet = new WalletManagerSolana(SEED_PHRASE, {
      provider: TEST_RPC_URL,
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

  describe('Token-2022', () => {
    const TRANSFER_FEE_BASIS_POINTS = 50

    async function getToken2022AccountAddress (token, owner) {
      const [ata] = await findAssociatedToken2022Pda({
        mint: token.mint,
        owner: address(owner),
        tokenProgram: TOKEN_2022_PROGRAM_ADDRESS
      })

      return ata
    }

    async function createToken2022Account (token, owner) {
      const ata = await getToken2022AccountAddress(token, owner)

      await sendInstructions(sendAndConfirmTransaction, rpc, token.mintAuthority, [
        getCreateAssociatedToken2022IdempotentInstruction({
          payer: token.mintAuthority,
          ata,
          owner: address(owner),
          mint: token.mint
        })
      ])

      return ata
    }

    async function sendToken2022To (token, to, value) {
      const ata = await createToken2022Account(token, to)

      await sendInstructions(sendAndConfirmTransaction, rpc, token.mintAuthority, [
        getMintTo2022Instruction({
          mint: token.mint,
          token: ata,
          mintAuthority: token.mintAuthority,
          amount: value
        })
      ])
    }

    function transferFeeConfig (authority) {
      const transferFee = { epoch: 0n, maximumFee: 1_000_000n, transferFeeBasisPoints: TRANSFER_FEE_BASIS_POINTS }

      return {
        __kind: 'TransferFeeConfig',
        transferFeeConfigAuthority: authority,
        withdrawWithheldAuthority: authority,
        withheldAmount: 0n,
        olderTransferFee: transferFee,
        newerTransferFee: transferFee
      }
    }

    test('should get the balance of a Token-2022 token', async () => {
      const token = await deployTestToken2022(rpc, sendAndConfirmTransaction)
      await sendToken2022To(token, ACCOUNT_0.address, INITIAL_TOKEN_BALANCE)

      const account = await wallet.getAccount(0)

      const tokenBalance = await account.getTokenBalance(token.mint)

      expect(tokenBalance).toBe(INITIAL_TOKEN_BALANCE)
    })

    test('should get the balances of a classic and a Token-2022 token in a single call', async () => {
      const token = await deployTestToken2022(rpc, sendAndConfirmTransaction)
      await sendToken2022To(token, ACCOUNT_0.address, 250n)

      const account = await wallet.getAccount(0)

      const tokenBalances = await account.getTokenBalances([testToken.mint, token.mint])

      expect(tokenBalances).toEqual({
        [testToken.mint]: INITIAL_TOKEN_BALANCE,
        [token.mint]: 250n
      })
    })

    test('should quote and transfer a Token-2022 token to an existing token account', async () => {
      const token = await deployTestToken2022(rpc, sendAndConfirmTransaction)
      await sendToken2022To(token, ACCOUNT_0.address, INITIAL_TOKEN_BALANCE)
      await sendToken2022To(token, ACCOUNT_1.address, INITIAL_TOKEN_BALANCE)

      const account0 = await wallet.getAccount(0)
      const account1 = await wallet.getAccount(1)

      const TRANSFER = { token: token.mint, recipient: ACCOUNT_1.address, amount: 100 }

      const quote = await account0.quoteTransfer(TRANSFER)

      expect(quote).toEqual({ fee: 5000n, rent: 0n, transferFee: 0n })

      const { hash, fee } = await account0.transfer(TRANSFER)
      await confirmTransaction(rpc, hash)
      const receipt = await account0.getTransaction(hash)

      expect(receipt.success).toBe(true)
      expect(fee).toBe(quote.fee)
      expect(await account0.getTokenBalance(token.mint)).toBe(INITIAL_TOKEN_BALANCE - 100n)
      expect(await account1.getTokenBalance(token.mint)).toBe(INITIAL_TOKEN_BALANCE + 100n)
    })

    test('should quote the rent and transfer a Token-2022 token creating the recipient token account', async () => {
      const token = await deployTestToken2022(rpc, sendAndConfirmTransaction)
      await sendToken2022To(token, ACCOUNT_0.address, INITIAL_TOKEN_BALANCE)

      const account = await wallet.getAccount(0)

      const TRANSFER = { token: token.mint, recipient: TEST_RECIPIENT_ADDRESS, amount: 100 }

      const quote = await account.quoteTransfer(TRANSFER)
      const balanceBefore = await account.getBalance()

      const { hash, fee } = await account.transfer(TRANSFER)
      await confirmTransaction(rpc, hash)
      const receipt = await account.getTransaction(hash)

      const recipientAta = await getToken2022AccountAddress(token, TEST_RECIPIENT_ADDRESS)
      const { value: recipientAtaInfo } = await rpc.getAccountInfo(recipientAta, { commitment: 'confirmed', encoding: 'base64' }).send()
      const recipient = new WalletAccountReadOnlySolana(TEST_RECIPIENT_ADDRESS, { provider: TEST_RPC_URL })

      expect(receipt.success).toBe(true)
      expect(fee).toBe(quote.fee)
      expect(quote.rent).toBe(recipientAtaInfo.lamports)
      expect(await account.getBalance()).toBe(balanceBefore - receipt.fee - quote.rent)
      expect(await account.getTokenBalance(token.mint)).toBe(INITIAL_TOKEN_BALANCE - 100n)
      expect(await recipient.getTokenBalance(token.mint)).toBe(100n)
    })

    test('should transfer a fee-bearing Token-2022 token gross and quote the withheld fee and the larger rent', async () => {
      const mintAuthority = await generateKeyPairSigner()
      const token = await deployTestToken2022(rpc, sendAndConfirmTransaction, [transferFeeConfig(mintAuthority.address)])
      await sendToken2022To(token, ACCOUNT_0.address, INITIAL_TOKEN_BALANCE)

      const account = await wallet.getAccount(0)
      const recipientAccount = await wallet.getAccount(1)

      const TRANSFER = { token: token.mint, recipient: ACCOUNT_1.address, amount: 10_000 }

      const EXPECTED_TRANSFER_FEE = 50n

      const quote = await account.quoteTransfer(TRANSFER)

      const { hash } = await account.transfer(TRANSFER)
      await confirmTransaction(rpc, hash)
      const receipt = await account.getTransaction(hash)

      const recipientAta = await getToken2022AccountAddress(token, ACCOUNT_1.address)
      const { value: recipientAtaInfo } = await rpc.getAccountInfo(recipientAta, { commitment: 'confirmed', encoding: 'base64' }).send()
      const transferFeeAccountRent = await rpc.getMinimumBalanceForRentExemption(182n, { commitment: 'confirmed' }).send()

      expect(receipt.success).toBe(true)
      expect(quote.transferFee).toBe(EXPECTED_TRANSFER_FEE)
      expect(quote.rent).toBe(recipientAtaInfo.lamports)
      expect(quote.rent).toBe(transferFeeAccountRent)
      expect(await account.getTokenBalance(token.mint)).toBe(INITIAL_TOKEN_BALANCE - 10_000n)
      expect(await recipientAccount.getTokenBalance(token.mint)).toBe(10_000n - EXPECTED_TRANSFER_FEE)
    })

    test('should get the raw balance of an interest-bearing Token-2022 token and transfer its raw amount', async () => {
      const rateAuthority = await generateKeyPairSigner()
      const token = await deployTestToken2022(rpc, sendAndConfirmTransaction, [{
        __kind: 'InterestBearingConfig',
        rateAuthority: rateAuthority.address,
        initializationTimestamp: 0n,
        preUpdateAverageRate: 0,
        lastUpdateTimestamp: 0n,
        currentRate: 32_767
      }])
      await sendToken2022To(token, ACCOUNT_0.address, INITIAL_TOKEN_BALANCE)
      await sendToken2022To(token, ACCOUNT_1.address, INITIAL_TOKEN_BALANCE)

      const account0 = await wallet.getAccount(0)
      const account1 = await wallet.getAccount(1)

      expect(await account0.getTokenBalance(token.mint)).toBe(INITIAL_TOKEN_BALANCE)

      const { hash } = await account0.transfer({ token: token.mint, recipient: ACCOUNT_1.address, amount: 100 })
      await confirmTransaction(rpc, hash)

      expect(await account0.getTokenBalance(token.mint)).toBe(INITIAL_TOKEN_BALANCE - 100n)
      expect(await account1.getTokenBalance(token.mint)).toBe(INITIAL_TOKEN_BALANCE + 100n)
    })

    test('should fail on chain without a memo and succeed with one when the recipient token account requires memos', async () => {
      const token = await deployTestToken2022(rpc, sendAndConfirmTransaction)
      await sendToken2022To(token, ACCOUNT_0.address, INITIAL_TOKEN_BALANCE)

      const recipientOwner = await generateKeyPairSigner()
      const recipientAta = await createToken2022Account(token, recipientOwner.address)

      await sendInstructions(sendAndConfirmTransaction, rpc, token.mintAuthority, [
        getReallocateInstruction({
          token: recipientAta,
          payer: token.mintAuthority,
          owner: recipientOwner,
          newExtensionTypes: [ExtensionType.MemoTransfer]
        }),
        getEnableMemoTransfersInstruction({ token: recipientAta, owner: recipientOwner })
      ])

      const account = await wallet.getAccount(0)

      const TRANSFER = { token: token.mint, recipient: recipientOwner.address, amount: 100 }

      const EXPECTED_NO_MEMO_LOG = `Program ${TOKEN_2022_PROGRAM_ADDRESS} failed: custom program error: 0x24`

      await expect(account.transfer(TRANSFER)).rejects.toMatchObject({
        context: { logs: expect.arrayContaining([EXPECTED_NO_MEMO_LOG]) }
      })

      expect(await account.getTokenBalance(token.mint)).toBe(INITIAL_TOKEN_BALANCE)

      const { hash } = await account.transfer(TRANSFER, { memo: 'invoice 42' })
      await confirmTransaction(rpc, hash)
      const receipt = await account.getTransaction(hash)

      expect(receipt.success).toBe(true)
      expect(await account.getTokenBalance(token.mint)).toBe(INITIAL_TOKEN_BALANCE - 100n)
    })

    test.each([
      ['non-transferable', () => [{ __kind: 'NonTransferable' }],
        mint => new NonTransferableTokenError(`Token '${mint}' is non-transferable.`)],
      ['carrying a transfer hook', (authority, hookProgram) => [{ __kind: 'TransferHook', authority, programId: hookProgram }],
        mint => new TransferHookNotSupportedError(`Token '${mint}' carries a transfer hook, which is not supported.`)],
      ['configured for confidential transfers', (authority) => [{ __kind: 'ConfidentialTransferMint', authority, autoApproveNewAccounts: true, auditorElgamalPubkey: null }],
        mint => new ConfidentialTransferNotSupportedError(`Token '${mint}' is configured for confidential transfers, which are not supported.`)],
      ['freezing new accounts by default', () => [{ __kind: 'DefaultAccountState', state: AccountState.Frozen }],
        mint => new FrozenTokenAccountError(`Token '${mint}' freezes by default the accounts it creates, so '${ACCOUNT_1.address}' could not receive it.`)]
    ])('should reject the transfer of a Token-2022 token %s without sending a transaction', async (_, extensionsFor, errorFor) => {
      const authority = await generateKeyPairSigner()
      const hookProgram = await generateKeyPairSigner()
      const token = await deployTestToken2022(rpc, sendAndConfirmTransaction, extensionsFor(authority.address, hookProgram.address))

      const account = await wallet.getAccount(0)

      const balanceBefore = await account.getBalance()

      const TRANSFER = { token: token.mint, recipient: ACCOUNT_1.address, amount: 100 }

      await expect(account.quoteTransfer(TRANSFER)).rejects.toThrow(errorFor(token.mint))
      await expect(account.transfer(TRANSFER)).rejects.toThrow(errorFor(token.mint))

      expect(await account.getBalance()).toBe(balanceBefore)
    })

    test('should quote the rent and transfer a Token-2022 token carrying a transfer hook with no hook program set', async () => {
      const authority = await generateKeyPairSigner()
      const token = await deployTestToken2022(rpc, sendAndConfirmTransaction, [{
        __kind: 'TransferHook',
        authority: authority.address,
        programId: address('11111111111111111111111111111111')
      }])
      await sendToken2022To(token, ACCOUNT_0.address, INITIAL_TOKEN_BALANCE)

      const account = await wallet.getAccount(0)

      const TRANSFER = { token: token.mint, recipient: TEST_RECIPIENT_ADDRESS, amount: 100 }

      const quote = await account.quoteTransfer(TRANSFER)

      const { hash, fee } = await account.transfer(TRANSFER)
      await confirmTransaction(rpc, hash)
      const receipt = await account.getTransaction(hash)

      const recipientAta = await getToken2022AccountAddress(token, TEST_RECIPIENT_ADDRESS)
      const { value: recipientAtaInfo } = await rpc.getAccountInfo(recipientAta, { commitment: 'confirmed', encoding: 'base64' }).send()
      const recipient = new WalletAccountReadOnlySolana(TEST_RECIPIENT_ADDRESS, { provider: TEST_RPC_URL })

      expect(receipt.success).toBe(true)
      expect(fee).toBe(quote.fee)
      expect(quote.rent).toBe(recipientAtaInfo.lamports)
      expect(await account.getTokenBalance(token.mint)).toBe(INITIAL_TOKEN_BALANCE - 100n)
      expect(await recipient.getTokenBalance(token.mint)).toBe(100n)
    })

    test('should transfer a Token-2022 token freezing new accounts by default between thawed token accounts', async () => {
      const token = await deployTestToken2022(rpc, sendAndConfirmTransaction, [{ __kind: 'DefaultAccountState', state: AccountState.Frozen }])
      const senderAta = await createToken2022Account(token, ACCOUNT_0.address)
      const recipientAta = await createToken2022Account(token, ACCOUNT_1.address)

      await sendInstructions(sendAndConfirmTransaction, rpc, token.mintAuthority, [
        getThawAccountInstruction({ account: senderAta, mint: token.mint, owner: token.mintAuthority }),
        getThawAccountInstruction({ account: recipientAta, mint: token.mint, owner: token.mintAuthority }),
        getMintTo2022Instruction({ mint: token.mint, token: senderAta, mintAuthority: token.mintAuthority, amount: INITIAL_TOKEN_BALANCE })
      ])

      const account0 = await wallet.getAccount(0)
      const account1 = await wallet.getAccount(1)

      const TRANSFER = { token: token.mint, recipient: ACCOUNT_1.address, amount: 100 }

      const quote = await account0.quoteTransfer(TRANSFER)

      const { hash, fee } = await account0.transfer(TRANSFER)
      await confirmTransaction(rpc, hash)
      const receipt = await account0.getTransaction(hash)

      expect(receipt.success).toBe(true)
      expect(quote).toEqual({ fee: 5000n, rent: 0n, transferFee: 0n })
      expect(fee).toBe(quote.fee)
      expect(await account0.getTokenBalance(token.mint)).toBe(INITIAL_TOKEN_BALANCE - 100n)
      expect(await account1.getTokenBalance(token.mint)).toBe(100n)
    })

    test('should reject the transfer of a Token-2022 token to a frozen token account without sending a transaction', async () => {
      const token = await deployTestToken2022(rpc, sendAndConfirmTransaction)
      await sendToken2022To(token, ACCOUNT_0.address, INITIAL_TOKEN_BALANCE)
      const recipientAta = await createToken2022Account(token, ACCOUNT_1.address)

      await sendInstructions(sendAndConfirmTransaction, rpc, token.mintAuthority, [
        getFreezeAccountInstruction({ account: recipientAta, mint: token.mint, owner: token.mintAuthority })
      ])

      const account = await wallet.getAccount(0)

      const balanceBefore = await account.getBalance()

      const TRANSFER = { token: token.mint, recipient: ACCOUNT_1.address, amount: 100 }

      await expect(account.transfer(TRANSFER)).rejects.toThrow(new FrozenTokenAccountError(`The token account of '${ACCOUNT_1.address}' is frozen.`))

      expect(await account.getBalance()).toBe(balanceBefore)
      expect(await account.getTokenBalance(token.mint)).toBe(INITIAL_TOKEN_BALANCE)
    })
  })
})
