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
import { generateKeyPairSigner } from '@solana/signers'
import { appendTransactionMessageInstructions, createTransactionMessage } from '@solana/transaction-messages'
import { pipe } from '@solana/functional'

import { WalletAccountReadOnlySolana, WalletAccountSolana } from '@tetherto/wdk-wallet-solana'

const LAMPORTS_PER_SOL = 1_000_000_000n

const TEST_SEED_PHRASE =
  'test walk nut penalty hip pave soap entry language right filter choice'
const TEST_RPC_URL = 'http://127.0.0.1:8899'
const TEST_TOKEN_DECIMALS = 6
const TEST_TOKEN_SUPPLY = 1_000_000_000n
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
 * @param {WalletAccountSolana} walletAccount
 * @returns {Promise<string>}
 */
async function deploySplToken (rpc, walletAccount) {
  if (!walletAccount._signer) {
    throw new Error('Wallet account signer is unavailable.')
  }

  const ownerAddress = await walletAccount.getAddress()
  const owner = address(ownerAddress)
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
      payer: walletAccount._signer,
      newAccount: mintSigner,
      lamports: mintRent,
      space: BigInt(getMintSize()),
      programAddress: TOKEN_PROGRAM_ADDRESS
    }),
    getInitializeMintInstruction({
      mint: mintAddress,
      decimals: TEST_TOKEN_DECIMALS,
      mintAuthority: owner,
      freezeAuthority: owner
    }),
    getCreateAssociatedTokenIdempotentInstruction({
      payer: owner,
      ata: ownerAta,
      owner,
      mint: mintAddress
    }),
    getMintToInstruction({
      mint: mintAddress,
      token: ownerAta,
      mintAuthority: walletAccount._signer,
      amount: TEST_TOKEN_SUPPLY
    })
  ]

  const transactionMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => appendTransactionMessageInstructions(instructions, tx)
  )

  const { hash } = await walletAccount.sendTransaction(transactionMessage)

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
    })

    beforeEach(async () => {
      const recipient = await account.getAddress()
      await rpc.requestAirdrop(address(recipient), LAMPORTS_PER_SOL, { commitment: 'confirmed' }).send()
    })

    test('should get balance', async () => {
      const amount = await account.getBalance()

      expect(amount).toBeGreaterThan(LAMPORTS_PER_SOL)
    })

    test('should successfully deploy (sendTransaction) an SPL token', async () => {
      tokenMintAddress = await deploySplToken(rpc, account)

      const mintAccount = await fetchMint(rpc, address(tokenMintAddress))

      expect(mintAccount.data.decimals).toBe(TEST_TOKEN_DECIMALS)
      expect(mintAccount.data.supply).toBe(TEST_TOKEN_SUPPLY)
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
