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

import { beforeAll, beforeEach, describe, expect, test } from '@jest/globals'
import { address } from '@solana/addresses'
import { fetchMint, findAssociatedTokenPda, getCreateAssociatedTokenIdempotentInstruction, getInitializeMintInstruction, getMintSize, getMintToInstruction, TOKEN_PROGRAM_ADDRESS } from '@solana-program/token'
import { getCreateAccountInstruction } from '@solana-program/system'
import { createSolanaRpc } from '@solana/rpc'
import { generateKeyPairSigner, setTransactionMessageFeePayerSigner, signTransactionMessageWithSigners } from '@solana/signers'
import { getBase64EncodedWireTransaction } from '@solana/transactions'
import { appendTransactionMessageInstructions, createTransactionMessage, setTransactionMessageLifetimeUsingBlockhash } from '@solana/transaction-messages'
import { pipe } from '@solana/functional'

import WalletAccountReadOnlySolana from '../../src/wallet-account-read-only-solana.js'
import WalletAccountSolana from '../../src/wallet-account-solana.js'

const LAMPORTS_PER_SOL = 1_000_000_000n

const TEST_SEED_PHRASE =
  'test walk nut penalty hip pave soap entry language right filter choice'
const TEST_RPC_URL = 'http://127.0.0.1:8899'
const TEST_TOKEN_DECIMALS = 6
const TEST_TOKEN_SUPPLY = 1_000_000_000n
const MEMO_PROGRAM_ADDRESS = address('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr')
const RPC_READY_RETRIES = 40
const RPC_READY_DELAY_MS = 500

/**
 * @param {ReturnType<typeof createSolanaRpc>} rpc
 * @param {string} signature
 * @returns {Promise<boolean>}
 */
async function confirmTransaction (rpc, signature) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const { value: [status] } = await rpc.getSignatureStatuses([signature]).send()

    if (status?.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`)
    }

    if (['confirmed', 'finalized'].includes(status?.confirmationStatus)) {
      return true
    }

    await new Promise(resolve => setTimeout(resolve, 250))
  }

  return false
}

/**
 * @param {ReturnType<typeof createSolanaRpc>} rpc
 * @returns {Promise<void>}
 */
async function waitForRpcReady (rpc) {
  for (let attempt = 0; attempt < RPC_READY_RETRIES; attempt++) {
    try {
      return await rpc.getLatestBlockhash({ commitment: 'confirmed' }).send()
    } catch {
      await new Promise(resolve => setTimeout(resolve, RPC_READY_DELAY_MS))
    }
  }

  throw new Error(`RPC was not ready at ${TEST_RPC_URL}`)
}

/**
 * @param {ReturnType<typeof createSolanaRpc>} rpc
 * @param {string} tokenOwnerAddress
 * @returns {Promise<string>}
 */
async function deploySplToken (rpc, tokenOwnerAddress) {
  const deployerSigner = await generateKeyPairSigner()
  const airdropSignature = await rpc
    .requestAirdrop(address(deployerSigner.address), LAMPORTS_PER_SOL, { commitment: 'confirmed' })
    .send()
  await confirmTransaction(rpc, airdropSignature)

  const owner = address(tokenOwnerAddress)
  const mintSigner = await generateKeyPairSigner()
  const mintAddress = address(mintSigner.address)
  const mintRent = await rpc
    .getMinimumBalanceForRentExemption(BigInt(getMintSize()), { commitment: 'confirmed' })
    .send()

  const [ownerAta] = await findAssociatedTokenPda({
    mint: mintAddress,
    owner,
    tokenProgram: TOKEN_PROGRAM_ADDRESS
  })

  const instructions = [
    getCreateAccountInstruction({
      payer: deployerSigner,
      newAccount: mintSigner,
      lamports: mintRent,
      space: BigInt(getMintSize()),
      programAddress: TOKEN_PROGRAM_ADDRESS
    }),
    getInitializeMintInstruction({
      mint: mintAddress,
      decimals: TEST_TOKEN_DECIMALS,
      mintAuthority: deployerSigner.address,
      freezeAuthority: deployerSigner.address
    }),
    getCreateAssociatedTokenIdempotentInstruction({
      payer: deployerSigner.address,
      ata: ownerAta,
      owner,
      mint: mintAddress
    }),
    getMintToInstruction({
      mint: mintAddress,
      token: ownerAta,
      mintAuthority: deployerSigner,
      amount: TEST_TOKEN_SUPPLY
    })
  ]

  const { value: latestBlockhash } = await rpc
    .getLatestBlockhash({ commitment: 'confirmed' })
    .send()
  const transactionMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayerSigner(deployerSigner, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx) => appendTransactionMessageInstructions(instructions, tx)
  )

  const signedTransaction = await signTransactionMessageWithSigners(transactionMessage)
  const encodedTransaction = getBase64EncodedWireTransaction(signedTransaction)
  const hash = await rpc.sendTransaction(encodedTransaction, { encoding: 'base64' }).send()

  const confirmed = await confirmTransaction(rpc, hash)

  if (!confirmed) {
    throw new Error(`Token deployment transaction was not confirmed: ${hash}`)
  }

  return mintAddress
}

describe('@tetherto/wdk-wallet-solana', () => {
  const rpc = createSolanaRpc(TEST_RPC_URL)

  beforeAll(async () => {
    await waitForRpcReady(rpc)
  })

  describe('WalletAccountSolana', () => {

    /**
     * @type {WalletAccountSolana}
     */
    let account

    /**
     * @type {string}
     */
    let tokenMintAddress

    beforeAll(async () => {
      account = await WalletAccountSolana.at(TEST_SEED_PHRASE, "0'/0'/0'", { rpcUrl: TEST_RPC_URL })

      const tokenOwnerAddress = await account.getAddress()
      tokenMintAddress = await deploySplToken(rpc, tokenOwnerAddress)
    })

    beforeEach(async () => {
      const recipient = await account.getAddress()
      const signature = await rpc.requestAirdrop(address(recipient), LAMPORTS_PER_SOL, { commitment: 'confirmed' }).send()
      const confirmed = await confirmTransaction(rpc, signature)

      if (!confirmed) {
        throw new Error(`Airdrop transaction was not confirmed: ${signature}`)
      }
    })

    test('should get balance', async () => {
      const amount = await account.getBalance()

      expect(amount).toBeGreaterThan(LAMPORTS_PER_SOL)
    })

    test('should get token balance', async () => {
      const tokenBalance = await account.getTokenBalance(tokenMintAddress)

      expect(tokenBalance).toBe(TEST_TOKEN_SUPPLY)
    })

    test('should get empty token balance', async () => {
      const emptySigner = await generateKeyPairSigner()
      const emptyAddress = address(emptySigner.address)

      const tokenBalance = await account.getTokenBalance(emptyAddress)

      expect(tokenBalance).toBe(0n)
    })

    test('should transfer lamports', async () => {
      const recipientSigner = await generateKeyPairSigner()
      const recipient = new WalletAccountReadOnlySolana(recipientSigner.address, {
        rpcUrl: TEST_RPC_URL
      })
      const recipientAddress = await recipient.getAddress()

      const balanceBefore = await recipient.getBalance()

      const transferAmount = 1_000_000n
      const { hash, fee } = await account.sendTransaction({
        to: recipientAddress,
        value: transferAmount
      })
      const confirmed = await confirmTransaction(rpc, hash)

      const balanceAfter = await recipient.getBalance()

      expect(confirmed).toBe(true)
      expect(fee).toBeGreaterThan(0n)
      expect(balanceAfter).toBe(balanceBefore + transferAmount)
    })

    test('should send transaction message', async () => {
      const memo = 'hello solana memo'
      const transactionMessage = pipe(
        createTransactionMessage({ version: 0 }),
        (tx) => appendTransactionMessageInstructions([
          {
            programAddress: MEMO_PROGRAM_ADDRESS,
            accounts: [],
            data: new TextEncoder().encode(memo)
          }
        ], tx)
      )
      const { hash, fee } = await account.sendTransaction(transactionMessage)
      const confirmed = await confirmTransaction(rpc, hash)

      expect(confirmed).toBe(true)
      expect(fee).toBeGreaterThan(0n)
    })

    test('should transfer tokens', async () => {
      const recipientSigner = await generateKeyPairSigner()
      const recipient = new WalletAccountReadOnlySolana(recipientSigner.address, {
        rpcUrl: TEST_RPC_URL
      })
      const recipientAddress = await recipient.getAddress()

      const transferAmount = 1_000_000n
      const { hash, fee } = await account.transfer({
        token: tokenMintAddress,
        recipient: recipientAddress,
        amount: transferAmount
      })
      const confirmed = await confirmTransaction(rpc, hash)

      const recipientTokenBalance = await recipient.getTokenBalance(tokenMintAddress)

      expect(confirmed).toBe(true)
      expect(fee).toBeGreaterThan(0n)
      expect(BigInt(recipientTokenBalance)).toBe(transferAmount)
    })

    test('should get transaction receipt', async () => {
      const recipientSigner = await generateKeyPairSigner()
      const recipient = new WalletAccountReadOnlySolana(recipientSigner.address, {
        rpcUrl: TEST_RPC_URL
      })
      const recipientAddress = await recipient.getAddress()

      const transferAmount = 1_000_000n
      const { hash } = await account.sendTransaction({
        to: recipientAddress,
        value: transferAmount
      })
      const confirmed = await confirmTransaction(rpc, hash)
      const receipt = await account.getTransactionReceipt(hash)

      expect(confirmed).toBe(true)
      expect(receipt).not.toBeNull()
      expect(receipt.transaction.signatures).toContain(hash)
      expect(receipt.meta.err).toBeNull()
      expect(receipt.meta.fee).toBeGreaterThan(0n)
      expect(receipt.slot).toBeGreaterThan(0n)
    })

    test('should sign and verify message', async () => {
      const message = 'hello solana'

      const signature = await account.sign(message)
      const verified = await account.verify(message, signature)

      expect(verified).toBe(true)
    })

    test('should reject tampered message signature', async () => {
      const message = 'hello solana'
      const tamperedMessage = 'hello solana!'

      const signature = await account.sign(message)
      const verifiedTampered = await account.verify(tamperedMessage, signature)

      expect(verifiedTampered).toBe(false)
    })
  })
})
