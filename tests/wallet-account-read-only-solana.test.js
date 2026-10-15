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

import { describe, it, expect, beforeEach, jest } from '@jest/globals'

import { address, getAddressDecoder } from '@solana/addresses'
import {
  compileTransaction,
  getBase64EncodedWireTransaction
} from '@solana/transactions'
import { getCompiledTransactionMessageDecoder } from '@solana/transaction-messages'
import { getBase64Encoder } from '@solana/codecs'
import {
  ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
  findAssociatedTokenPda,
  TOKEN_PROGRAM_ADDRESS
} from '@solana-program/token'
import { AccountState as AccountState2022, getExtensionEncoder, TOKEN_2022_PROGRAM_ADDRESS } from '@solana-program/token-2022'
import { LEGACY_MEMO_PROGRAM_ADDRESS_V3 } from '@solana-program/memo'

import WalletAccountReadOnlySolana from '../src/wallet-account-read-only-solana.js'
import {
  ConfidentialTransferNotSupportedError,
  FrozenTokenAccountError,
  NonTransferableTokenError,
  TransferHookNotSupportedError
} from '../src/errors.js'
import { NoSuchElementError, ProviderRequiredError, ValueError } from '@tetherto/wdk-wallet'
import WalletAccountSolana from '../src/wallet-account-solana.js'

const TEST_ADDRESS = 'HmWPZeFgxZAJQYgwh5ipYwjbVTHtjEHB3dnJ5xcQBHX9'
const TEST_ACCOUNT_ADDRESS = '3uXqWpwgqKVdiHAwF6Vmu4G4vdQzpR66xjPkz1G7zMKE'
const TEST_SEED_PHRASE =
  'test walk nut penalty hip pave soap entry language right filter choice'
const TEST_RPC_URL = 'https://mockurl.com'

const ACCOUNT_TYPE_MINT = 1
const ACCOUNT_TYPE_TOKEN = 2

/**
 * Appends a Token-2022 extension suffix to a base layout: the base padded to 165 bytes,
 * the account type discriminator, then one TLV entry per extension.
 */
function withExtensions (base, accountType, extensions) {
  const padded = Buffer.alloc(166)
  base.copy(padded)
  padded.writeUInt8(accountType, 165)

  const entries = extensions.map(extension => Buffer.from(getExtensionEncoder().encode(extension)))

  return Buffer.concat([padded, ...entries])
}

/** Creates a mock mint account owned by the given token program. */
function createMintAccount (tokenProgram = TOKEN_PROGRAM_ADDRESS, { size = 82, accountType, decimals = 0, extensions } = {}) {
  let buffer = Buffer.alloc(size)
  buffer.writeUInt8(decimals, 44)

  if (accountType !== undefined) {
    buffer.writeUInt8(accountType, 165)
  }
  if (extensions) {
    buffer = withExtensions(buffer, ACCOUNT_TYPE_MINT, extensions)
  }

  return { data: [buffer.toString('base64'), 'base64'], owner: tokenProgram, lamports: 1461600n }
}

/** Creates a mock token account holding the given amount (offset 64, little-endian u64). */
function createTokenAccount (amount, tokenProgram = TOKEN_PROGRAM_ADDRESS, { state = 1, extensions } = {}) {
  let buffer = Buffer.alloc(165)
  buffer.writeBigUInt64LE(BigInt(amount), 64)
  buffer.writeUInt8(state, 108)

  if (extensions) {
    buffer = withExtensions(buffer, ACCOUNT_TYPE_TOKEN, extensions)
  }

  return { data: [buffer.toString('base64'), 'base64'], owner: tokenProgram, lamports: 2039280n }
}

/** Returns the rent-exempt deposit for an account of the given size, as the runtime computes it. */
function rentFor (size) {
  return (128n + BigInt(size)) * 6960n
}

/** Creates a mock RPC response resolving to the given value. */
function mockSend (value) {
  return { send: jest.fn().mockResolvedValue({ value }) }
}

/** Decodes the instructions of the message a transfer quote passed to `getFeeForMessage`. */
function decodeQuotedInstructions (getFeeForMessage) {
  const [base64EncodedMessage] = getFeeForMessage.mock.calls[0]
  const { staticAccounts, instructions } = getCompiledTransactionMessageDecoder()
    .decode(getBase64Encoder().encode(base64EncodedMessage))

  return instructions.map(instruction => ({
    programAddress: staticAccounts[instruction.programAddressIndex],
    accounts: (instruction.accountIndices ?? []).map(index => staticAccounts[index]),
    data: instruction.data
  }))
}

describe('WalletAccountReadOnlySolana', () => {
  let readOnlyAccount
  let mockRpc

  beforeEach(() => {
    readOnlyAccount = new WalletAccountReadOnlySolana(TEST_ADDRESS, {})

    mockRpc = {
      getBalance: jest.fn(),
      getAccountInfo: jest.fn(),
      getLatestBlockhash: jest.fn(),
      getFeeForMessage: jest.fn(),
      getTransaction: jest.fn(),
      getSignatureStatuses: jest.fn(),
      getMultipleAccounts: jest.fn(),
      getMinimumBalanceForRentExemption: jest.fn(),
      getEpochInfo: jest.fn()
    }

    readOnlyAccount._rpc = mockRpc
    readOnlyAccount._commitment = 'confirmed'
  })

  describe('Constructor', () => {
    it('should create instance with valid config', () => {
      const account = new WalletAccountReadOnlySolana(TEST_ADDRESS, {
        provider: TEST_RPC_URL,
        commitment: 'confirmed'
      })

      expect(account).toBeInstanceOf(WalletAccountReadOnlySolana)
      expect(account._rpc).toBeDefined()
      expect(account._commitment).toBe('confirmed')
    })

    it('should create instance without provider', () => {
      const account = new WalletAccountReadOnlySolana(TEST_ADDRESS, {})
      expect(account._rpc).toBeUndefined()
    })

    it('should use default commitment level', () => {
      const account = new WalletAccountReadOnlySolana(TEST_ADDRESS, {
        provider: TEST_RPC_URL
      })
      expect(account._commitment).toBe('confirmed')
    })
  })

  describe('getBalance', () => {
    it('should return SOL balance in lamports', async () => {
      mockRpc.getBalance.mockReturnValue({
        send: jest.fn().mockResolvedValue({ value: 1000000000n })
      })

      const balance = await readOnlyAccount.getBalance()

      expect(balance).toBe(1000000000n)
      expect(mockRpc.getBalance).toHaveBeenCalledTimes(1)
    })

    it('should return zero balance for empty account', async () => {
      mockRpc.getBalance.mockReturnValue({
        send: jest.fn().mockResolvedValue({ value: 0n })
      })

      const balance = await readOnlyAccount.getBalance()

      expect(balance).toBe(0n)
    })

    it('should throw error when not connected to provider', async () => {
      const disconnectedAccount = new WalletAccountReadOnlySolana(
        TEST_ADDRESS,
        {}
      )

      await expect(disconnectedAccount.getBalance()).rejects.toThrow(
        'The wallet must be connected to a provider to retrieve balances.'
      )
    })

    it('should handle RPC errors gracefully', async () => {
      mockRpc.getBalance.mockReturnValue({
        send: jest.fn().mockRejectedValue(new Error('RPC error'))
      })

      await expect(readOnlyAccount.getBalance()).rejects.toThrow('RPC error')
    })

    it('should pass commitment level to RPC call', async () => {
      mockRpc.getBalance.mockReturnValue({
        send: jest.fn().mockResolvedValue({ value: 1000000000n })
      })

      await readOnlyAccount.getBalance()

      expect(mockRpc.getBalance).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ commitment: 'confirmed' })
      )
    })
  })

  describe('getTokenBalance', () => {
    const MOCK_TOKEN_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'
    const MOCK_TOKEN_2022_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

    beforeEach(() => {
      mockRpc.getMultipleAccounts.mockReturnValue(mockSend([createMintAccount()]))
    })

    it('should return token balance when ATA exists (TOKEN_PROGRAM)', async () => {
      mockRpc.getAccountInfo.mockReturnValueOnce(mockSend(createTokenAccount(1000000)))

      const balance = await readOnlyAccount.getTokenBalance(MOCK_TOKEN_MINT)

      const [ata] = await findAssociatedTokenPda({
        mint: address(MOCK_TOKEN_MINT),
        owner: address(TEST_ADDRESS),
        tokenProgram: TOKEN_PROGRAM_ADDRESS
      })

      expect(balance).toBe(1000000n)
      expect(mockRpc.getAccountInfo).toHaveBeenCalledTimes(1)
      expect(mockRpc.getAccountInfo).toHaveBeenCalledWith(ata, { commitment: 'confirmed', encoding: 'base64' })
    })

    it('should read the Token-2022 ATA when the mint belongs to the token extensions program', async () => {
      mockRpc.getMultipleAccounts.mockReturnValue(mockSend([createMintAccount(TOKEN_2022_PROGRAM_ADDRESS, { size: 278, accountType: 1 })]))
      mockRpc.getAccountInfo.mockReturnValueOnce(mockSend(createTokenAccount(2500000, TOKEN_2022_PROGRAM_ADDRESS, { extensions: [] })))

      const balance = await readOnlyAccount.getTokenBalance(MOCK_TOKEN_2022_MINT)

      const [ata] = await findAssociatedTokenPda({
        mint: address(MOCK_TOKEN_2022_MINT),
        owner: address(TEST_ADDRESS),
        tokenProgram: TOKEN_2022_PROGRAM_ADDRESS
      })

      expect(balance).toBe(2500000n)
      expect(mockRpc.getAccountInfo).toHaveBeenCalledWith(ata, { commitment: 'confirmed', encoding: 'base64' })
    })

    it('should return zero when ATA does not exist', async () => {
      mockRpc.getAccountInfo.mockReturnValueOnce(mockSend(null))

      const balance = await readOnlyAccount.getTokenBalance(MOCK_TOKEN_MINT)

      expect(balance).toBe(0n)
      expect(mockRpc.getAccountInfo).toHaveBeenCalledTimes(1)
    })

    it('should return zero balance when ATA exists but has no tokens', async () => {
      mockRpc.getAccountInfo.mockReturnValue(mockSend(createTokenAccount(0)))

      const balance = await readOnlyAccount.getTokenBalance(MOCK_TOKEN_MINT)

      expect(balance).toBe(0n)
    })

    it('should resolve the mint only once across calls while its token account exists', async () => {
      mockRpc.getAccountInfo.mockReturnValue(mockSend(createTokenAccount(1000000)))

      await readOnlyAccount.getTokenBalance(MOCK_TOKEN_MINT)
      const balance = await readOnlyAccount.getTokenBalance(MOCK_TOKEN_MINT)

      const [ata] = await findAssociatedTokenPda({
        mint: address(MOCK_TOKEN_MINT),
        owner: address(TEST_ADDRESS),
        tokenProgram: TOKEN_PROGRAM_ADDRESS
      })

      expect(balance).toBe(1000000n)
      expect(mockRpc.getMultipleAccounts).toHaveBeenCalledTimes(1)
      expect(mockRpc.getMultipleAccounts).toHaveBeenCalledWith([address(MOCK_TOKEN_MINT)], { commitment: 'confirmed', encoding: 'base64' })
      expect(mockRpc.getAccountInfo).toHaveBeenCalledTimes(2)
      expect(mockRpc.getAccountInfo).toHaveBeenNthCalledWith(1, ata, { commitment: 'confirmed', encoding: 'base64' })
      expect(mockRpc.getAccountInfo).toHaveBeenNthCalledWith(2, ata, { commitment: 'confirmed', encoding: 'base64' })
    })

    it('should fetch a cached mint again when its token account is missing', async () => {
      mockRpc.getAccountInfo.mockReturnValue(mockSend(null))

      await readOnlyAccount.getTokenBalance(MOCK_TOKEN_MINT)
      const balance = await readOnlyAccount.getTokenBalance(MOCK_TOKEN_MINT)

      expect(balance).toBe(0n)
      expect(mockRpc.getMultipleAccounts).toHaveBeenCalledTimes(2)
      expect(mockRpc.getAccountInfo).toHaveBeenCalledTimes(2)
    })

    it('should read the classic ATA once a cached Token-2022 mint is re-created under the classic program', async () => {
      mockRpc.getMultipleAccounts
        .mockReturnValueOnce(mockSend([createMintAccount(TOKEN_2022_PROGRAM_ADDRESS)]))
        .mockReturnValueOnce(mockSend([createMintAccount(TOKEN_PROGRAM_ADDRESS)]))
      mockRpc.getAccountInfo
        .mockReturnValueOnce(mockSend(null))
        .mockReturnValueOnce(mockSend(null))
        .mockReturnValueOnce(mockSend(createTokenAccount(500)))

      await readOnlyAccount.getTokenBalance(MOCK_TOKEN_2022_MINT)
      const balance = await readOnlyAccount.getTokenBalance(MOCK_TOKEN_2022_MINT)

      const [classicAta] = await findAssociatedTokenPda({
        mint: address(MOCK_TOKEN_2022_MINT),
        owner: address(TEST_ADDRESS),
        tokenProgram: TOKEN_PROGRAM_ADDRESS
      })

      expect(balance).toBe(500n)
      expect(mockRpc.getAccountInfo).toHaveBeenLastCalledWith(classicAta, { commitment: 'confirmed', encoding: 'base64' })
    })

    it('should read the classic ATA directly once a re-created mint has been fetched again', async () => {
      mockRpc.getMultipleAccounts
        .mockReturnValueOnce(mockSend([createMintAccount(TOKEN_2022_PROGRAM_ADDRESS)]))
        .mockReturnValueOnce(mockSend([createMintAccount(TOKEN_PROGRAM_ADDRESS)]))
      mockRpc.getAccountInfo
        .mockReturnValueOnce(mockSend(null))
        .mockReturnValueOnce(mockSend(null))
        .mockReturnValue(mockSend(createTokenAccount(500)))

      await readOnlyAccount.getTokenBalance(MOCK_TOKEN_2022_MINT)
      await readOnlyAccount.getTokenBalance(MOCK_TOKEN_2022_MINT)
      const balance = await readOnlyAccount.getTokenBalance(MOCK_TOKEN_2022_MINT)

      const [classicAta] = await findAssociatedTokenPda({
        mint: address(MOCK_TOKEN_2022_MINT),
        owner: address(TEST_ADDRESS),
        tokenProgram: TOKEN_PROGRAM_ADDRESS
      })

      expect(balance).toBe(500n)
      expect(mockRpc.getMultipleAccounts).toHaveBeenCalledTimes(2)
      expect(mockRpc.getAccountInfo).toHaveBeenCalledTimes(4)
      expect(mockRpc.getAccountInfo).toHaveBeenNthCalledWith(4, classicAta, { commitment: 'confirmed', encoding: 'base64' })
    })

    it('should throw NoSuchElementError once a cached mint is closed', async () => {
      mockRpc.getMultipleAccounts
        .mockReturnValueOnce(mockSend([createMintAccount(TOKEN_2022_PROGRAM_ADDRESS)]))
        .mockReturnValueOnce(mockSend([null]))
      mockRpc.getAccountInfo.mockReturnValue(mockSend(null))

      await readOnlyAccount.getTokenBalance(MOCK_TOKEN_2022_MINT)

      await expect(readOnlyAccount.getTokenBalance(MOCK_TOKEN_2022_MINT)).rejects.toThrow(new NoSuchElementError(
        `No mint account found for '${MOCK_TOKEN_2022_MINT}'.`
      ))
    })

    it('should throw NoSuchElementError when the mint does not exist', async () => {
      mockRpc.getMultipleAccounts.mockReturnValue(mockSend([null]))

      await expect(readOnlyAccount.getTokenBalance(MOCK_TOKEN_MINT)).rejects.toThrow(new NoSuchElementError(
        `No mint account found for '${MOCK_TOKEN_MINT}'.`
      ))
    })

    it('should read the Token-2022 ATA of a Token-2022 mint without extensions', async () => {
      mockRpc.getMultipleAccounts.mockReturnValue(mockSend([createMintAccount(TOKEN_2022_PROGRAM_ADDRESS)]))
      mockRpc.getAccountInfo.mockReturnValueOnce(mockSend(null))

      const balance = await readOnlyAccount.getTokenBalance(MOCK_TOKEN_2022_MINT)

      const [ata] = await findAssociatedTokenPda({
        mint: address(MOCK_TOKEN_2022_MINT),
        owner: address(TEST_ADDRESS),
        tokenProgram: TOKEN_2022_PROGRAM_ADDRESS
      })

      expect(balance).toBe(0n)
      expect(mockRpc.getAccountInfo).toHaveBeenCalledWith(ata, { commitment: 'confirmed', encoding: 'base64' })
    })

    it('should throw ValueError when the address is not a mint', async () => {
      mockRpc.getMultipleAccounts.mockReturnValue(mockSend([createTokenAccount(0)]))

      await expect(readOnlyAccount.getTokenBalance(MOCK_TOKEN_MINT)).rejects.toThrow(new ValueError(
        `'${MOCK_TOKEN_MINT}' is not a mint account.`
      ))
    })

    it('should throw ValueError when the address is a Token-2022 token account', async () => {
      mockRpc.getMultipleAccounts.mockReturnValue(mockSend([
        createMintAccount(TOKEN_2022_PROGRAM_ADDRESS, { size: 278, accountType: ACCOUNT_TYPE_TOKEN })
      ]))

      await expect(readOnlyAccount.getTokenBalance(MOCK_TOKEN_2022_MINT)).rejects.toThrow(new ValueError(
        `'${MOCK_TOKEN_2022_MINT}' is not a mint account.`
      ))
    })

    it('should throw ValueError when the address is owned by neither token program', async () => {
      mockRpc.getMultipleAccounts.mockReturnValue(mockSend([createMintAccount('11111111111111111111111111111111')]))

      await expect(readOnlyAccount.getTokenBalance(MOCK_TOKEN_MINT)).rejects.toThrow(new ValueError(
        `'${MOCK_TOKEN_MINT}' is not owned by a supported token program.`
      ))
    })

    it('should throw error when not connected to provider', async () => {
      const disconnectedAccount = new WalletAccountReadOnlySolana(
        TEST_ADDRESS,
        {}
      )

      await expect(
        disconnectedAccount.getTokenBalance(MOCK_TOKEN_MINT)
      ).rejects.toThrow(
        'The wallet must be connected to a provider to retrieve token balances.'
      )
    })

    it('should throw error for invalid token mint address', async () => {
      const invalidMint = 'invalid-mint-address'

      await expect(
        readOnlyAccount.getTokenBalance(invalidMint)
      ).rejects.toThrow()
    })

    it('should throw error when getAccountInfo fails', async () => {
      mockRpc.getAccountInfo.mockReturnValue({
        send: jest
          .fn()
          .mockRejectedValue(
            new Error('RPC error: Failed to fetch account info')
          )
      })

      await expect(
        readOnlyAccount.getTokenBalance(MOCK_TOKEN_MINT)
      ).rejects.toThrow('RPC error: Failed to fetch account info')
    })

    it('should handle different token mints', async () => {
      const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'
      const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

      mockRpc.getAccountInfo
        .mockReturnValueOnce(mockSend(createTokenAccount(1000000)))
        .mockReturnValueOnce(mockSend(createTokenAccount(5000000)))

      const usdtBalance = await readOnlyAccount.getTokenBalance(USDT_MINT)
      const usdcBalance = await readOnlyAccount.getTokenBalance(USDC_MINT)

      const [usdtAta] = await findAssociatedTokenPda({
        mint: address(USDT_MINT),
        owner: address(TEST_ADDRESS),
        tokenProgram: TOKEN_PROGRAM_ADDRESS
      })
      const [usdcAta] = await findAssociatedTokenPda({
        mint: address(USDC_MINT),
        owner: address(TEST_ADDRESS),
        tokenProgram: TOKEN_PROGRAM_ADDRESS
      })

      expect(usdtBalance).toBe(1000000n)
      expect(usdcBalance).toBe(5000000n)
      expect(mockRpc.getAccountInfo).toHaveBeenCalledTimes(2)
      expect(mockRpc.getAccountInfo).toHaveBeenNthCalledWith(
        1,
        usdtAta,
        expect.objectContaining({ commitment: 'confirmed', encoding: 'base64' })
      )
      expect(mockRpc.getAccountInfo).toHaveBeenNthCalledWith(
        2,
        usdcAta,
        expect.objectContaining({ commitment: 'confirmed', encoding: 'base64' })
      )
    })
  })

  describe('getTokenBalances', () => {
    const MOCK_TOKEN_MINT_1 = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'
    const MOCK_TOKEN_MINT_2 = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

    /** Mocks the mint resolution call, then the ATA call, in that order. */
    function mockMintsThenAtas (mints, atas) {
      mockRpc.getMultipleAccounts
        .mockReturnValueOnce(mockSend(mints))
        .mockReturnValueOnce(mockSend(atas))
    }

    it('should return balances for multiple tokens', async () => {
      mockMintsThenAtas(
        [createMintAccount(), createMintAccount()],
        [createTokenAccount(1000000), createTokenAccount(5000000)]
      )

      const balances = await readOnlyAccount.getTokenBalances([MOCK_TOKEN_MINT_1, MOCK_TOKEN_MINT_2])

      expect(balances[MOCK_TOKEN_MINT_1]).toBe(1000000n)
      expect(balances[MOCK_TOKEN_MINT_2]).toBe(5000000n)
      expect(mockRpc.getMultipleAccounts).toHaveBeenCalledTimes(2)
    })

    it('should return balances for a mix of both token programs in one call', async () => {
      mockMintsThenAtas(
        [createMintAccount(), createMintAccount(TOKEN_2022_PROGRAM_ADDRESS, { size: 278, accountType: 1 })],
        [createTokenAccount(1000000), createTokenAccount(7000000, TOKEN_2022_PROGRAM_ADDRESS, { extensions: [] })]
      )

      const balances = await readOnlyAccount.getTokenBalances([MOCK_TOKEN_MINT_1, MOCK_TOKEN_MINT_2])

      const [classicAta] = await findAssociatedTokenPda({
        mint: address(MOCK_TOKEN_MINT_1),
        owner: address(TEST_ADDRESS),
        tokenProgram: TOKEN_PROGRAM_ADDRESS
      })
      const [token2022Ata] = await findAssociatedTokenPda({
        mint: address(MOCK_TOKEN_MINT_2),
        owner: address(TEST_ADDRESS),
        tokenProgram: TOKEN_2022_PROGRAM_ADDRESS
      })

      expect(balances[MOCK_TOKEN_MINT_1]).toBe(1000000n)
      expect(balances[MOCK_TOKEN_MINT_2]).toBe(7000000n)
      expect(mockRpc.getMultipleAccounts.mock.calls[0][0]).toEqual([address(MOCK_TOKEN_MINT_1), address(MOCK_TOKEN_MINT_2)])
      expect(mockRpc.getMultipleAccounts.mock.calls[1][0]).toEqual([classicAta, token2022Ata])
    })

    it('should split the mint and ATA requests beyond the 100-account RPC limit', async () => {
      const addressDecoder = getAddressDecoder()
      const mints = Array.from({ length: 101 }, (_, i) => {
        const bytes = new Uint8Array(32)
        bytes[0] = i + 1
        return addressDecoder.decode(bytes)
      })

      mockRpc.getMultipleAccounts
        .mockReturnValueOnce(mockSend(Array.from({ length: 100 }, () => createMintAccount())))
        .mockReturnValueOnce(mockSend([createMintAccount(TOKEN_2022_PROGRAM_ADDRESS)]))
        .mockReturnValueOnce(mockSend(Array.from({ length: 100 }, () => null)))
        .mockReturnValueOnce(mockSend([createTokenAccount(42, TOKEN_2022_PROGRAM_ADDRESS, { extensions: [] })]))

      const balances = await readOnlyAccount.getTokenBalances(mints)

      const [lastAta] = await findAssociatedTokenPda({
        mint: address(mints[100]),
        owner: address(TEST_ADDRESS),
        tokenProgram: TOKEN_2022_PROGRAM_ADDRESS
      })

      expect(mockRpc.getMultipleAccounts.mock.calls.map(([addresses]) => addresses.length)).toEqual([100, 1, 100, 1])
      expect(mockRpc.getMultipleAccounts.mock.calls[3][0]).toEqual([lastAta])
      expect(balances[mints[0]]).toBe(0n)
      expect(balances[mints[100]]).toBe(42n)
    })

    it('should return 0n for tokens where ATA does not exist', async () => {
      mockMintsThenAtas([createMintAccount(), createMintAccount()], [null, null])

      const balances = await readOnlyAccount.getTokenBalances([MOCK_TOKEN_MINT_1, MOCK_TOKEN_MINT_2])

      expect(balances[MOCK_TOKEN_MINT_1]).toBe(0n)
      expect(balances[MOCK_TOKEN_MINT_2]).toBe(0n)
    })

    it('should handle mix of existing and non-existing ATAs', async () => {
      mockMintsThenAtas(
        [createMintAccount(), createMintAccount()],
        [createTokenAccount(1000000), null]
      )

      const balances = await readOnlyAccount.getTokenBalances([MOCK_TOKEN_MINT_1, MOCK_TOKEN_MINT_2])

      expect(balances[MOCK_TOKEN_MINT_1]).toBe(1000000n)
      expect(balances[MOCK_TOKEN_MINT_2]).toBe(0n)
    })

    it('should deduplicate token addresses', async () => {
      mockMintsThenAtas([createMintAccount()], [createTokenAccount(1000000)])

      const balances = await readOnlyAccount.getTokenBalances([MOCK_TOKEN_MINT_1, MOCK_TOKEN_MINT_1, MOCK_TOKEN_MINT_1])

      expect(Object.keys(balances)).toHaveLength(1)
      expect(balances[MOCK_TOKEN_MINT_1]).toBe(1000000n)
      expect(mockRpc.getMultipleAccounts.mock.calls[0][0]).toHaveLength(1)
      expect(mockRpc.getMultipleAccounts.mock.calls[1][0]).toHaveLength(1)
    })

    it('should handle single token address', async () => {
      mockMintsThenAtas([createMintAccount()], [createTokenAccount(999999)])

      const balances = await readOnlyAccount.getTokenBalances([MOCK_TOKEN_MINT_1])

      expect(balances[MOCK_TOKEN_MINT_1]).toBe(999999n)
      expect(Object.keys(balances)).toHaveLength(1)
    })

    it('should handle zero balance in existing ATA', async () => {
      mockMintsThenAtas([createMintAccount()], [createTokenAccount(0)])

      const balances = await readOnlyAccount.getTokenBalances([MOCK_TOKEN_MINT_1])

      expect(balances[MOCK_TOKEN_MINT_1]).toBe(0n)
    })

    it('should reuse mints already resolved by an earlier call', async () => {
      mockMintsThenAtas([createMintAccount()], [createTokenAccount(1000000)])
      mockRpc.getMultipleAccounts.mockReturnValueOnce(mockSend([createTokenAccount(2000000)]))

      await readOnlyAccount.getTokenBalances([MOCK_TOKEN_MINT_1])
      const balances = await readOnlyAccount.getTokenBalances([MOCK_TOKEN_MINT_1])

      const [ata] = await findAssociatedTokenPda({
        mint: address(MOCK_TOKEN_MINT_1),
        owner: address(TEST_ADDRESS),
        tokenProgram: TOKEN_PROGRAM_ADDRESS
      })

      expect(balances[MOCK_TOKEN_MINT_1]).toBe(2000000n)
      expect(mockRpc.getMultipleAccounts).toHaveBeenCalledTimes(3)
      expect(mockRpc.getMultipleAccounts).toHaveBeenNthCalledWith(1, [address(MOCK_TOKEN_MINT_1)], { commitment: 'confirmed', encoding: 'base64' })
      expect(mockRpc.getMultipleAccounts).toHaveBeenNthCalledWith(2, [ata], { commitment: 'confirmed', encoding: 'base64' })
      expect(mockRpc.getMultipleAccounts).toHaveBeenNthCalledWith(3, [ata], { commitment: 'confirmed', encoding: 'base64' })
    })

    it('should read the classic ATA of a cached Token-2022 mint re-created under the classic program', async () => {
      mockMintsThenAtas([createMintAccount(TOKEN_2022_PROGRAM_ADDRESS)], [null])
      mockRpc.getMultipleAccounts
        .mockReturnValueOnce(mockSend([null]))
        .mockReturnValueOnce(mockSend([createMintAccount(TOKEN_PROGRAM_ADDRESS)]))
        .mockReturnValueOnce(mockSend([createTokenAccount(500)]))

      await readOnlyAccount.getTokenBalances([MOCK_TOKEN_MINT_2])
      const balances = await readOnlyAccount.getTokenBalances([MOCK_TOKEN_MINT_2])

      const [classicAta] = await findAssociatedTokenPda({
        mint: address(MOCK_TOKEN_MINT_2),
        owner: address(TEST_ADDRESS),
        tokenProgram: TOKEN_PROGRAM_ADDRESS
      })

      expect(balances).toEqual({ [MOCK_TOKEN_MINT_2]: 500n })
      expect(mockRpc.getMultipleAccounts.mock.calls[4][0]).toEqual([classicAta])
    })

    it('should read the classic ATA directly once a re-created mint has been fetched again', async () => {
      mockMintsThenAtas([createMintAccount(TOKEN_2022_PROGRAM_ADDRESS)], [null])
      mockRpc.getMultipleAccounts
        .mockReturnValueOnce(mockSend([null]))
        .mockReturnValueOnce(mockSend([createMintAccount(TOKEN_PROGRAM_ADDRESS)]))
        .mockReturnValueOnce(mockSend([createTokenAccount(500)]))
        .mockReturnValueOnce(mockSend([createTokenAccount(500)]))

      await readOnlyAccount.getTokenBalances([MOCK_TOKEN_MINT_2])
      await readOnlyAccount.getTokenBalances([MOCK_TOKEN_MINT_2])
      const balances = await readOnlyAccount.getTokenBalances([MOCK_TOKEN_MINT_2])

      const [classicAta] = await findAssociatedTokenPda({
        mint: address(MOCK_TOKEN_MINT_2),
        owner: address(TEST_ADDRESS),
        tokenProgram: TOKEN_PROGRAM_ADDRESS
      })

      expect(balances).toEqual({ [MOCK_TOKEN_MINT_2]: 500n })
      expect(mockRpc.getMultipleAccounts).toHaveBeenCalledTimes(6)
      expect(mockRpc.getMultipleAccounts).toHaveBeenNthCalledWith(6, [classicAta], { commitment: 'confirmed', encoding: 'base64' })
    })

    it('should fetch only the cached mints whose token account is missing again', async () => {
      mockMintsThenAtas([createMintAccount(), createMintAccount()], [createTokenAccount(1000000), null])
      mockRpc.getMultipleAccounts
        .mockReturnValueOnce(mockSend([createTokenAccount(1000000), null]))
        .mockReturnValueOnce(mockSend([createMintAccount()]))

      await readOnlyAccount.getTokenBalances([MOCK_TOKEN_MINT_1, MOCK_TOKEN_MINT_2])
      const balances = await readOnlyAccount.getTokenBalances([MOCK_TOKEN_MINT_1, MOCK_TOKEN_MINT_2])

      expect(balances).toEqual({ [MOCK_TOKEN_MINT_1]: 1000000n, [MOCK_TOKEN_MINT_2]: 0n })
      expect(mockRpc.getMultipleAccounts.mock.calls[3][0]).toEqual([address(MOCK_TOKEN_MINT_2)])
      expect(mockRpc.getMultipleAccounts).toHaveBeenCalledTimes(4)
    })

    it('should throw NoSuchElementError once a cached mint is closed', async () => {
      mockMintsThenAtas([createMintAccount(TOKEN_2022_PROGRAM_ADDRESS)], [null])
      mockRpc.getMultipleAccounts
        .mockReturnValueOnce(mockSend([null]))
        .mockReturnValueOnce(mockSend([null]))

      await readOnlyAccount.getTokenBalances([MOCK_TOKEN_MINT_2])

      await expect(readOnlyAccount.getTokenBalances([MOCK_TOKEN_MINT_2])).rejects.toThrow(new NoSuchElementError(
        `No mint account found for '${MOCK_TOKEN_MINT_2}'.`
      ))
    })

    it('should handle empty token addresses array', async () => {
      const balances = await readOnlyAccount.getTokenBalances([])

      expect(balances).toEqual({})
      expect(mockRpc.getMultipleAccounts).not.toHaveBeenCalled()
    })

    it('should throw error when not connected to provider', async () => {
      const disconnectedAccount = new WalletAccountReadOnlySolana(TEST_ADDRESS, {})

      await expect(disconnectedAccount.getTokenBalances([MOCK_TOKEN_MINT_1])).rejects.toThrow(
        'The wallet must be connected to a provider to retrieve token balances.'
      )
    })

    it('should throw NoSuchElementError when one of the mints does not exist', async () => {
      mockRpc.getMultipleAccounts.mockReturnValueOnce(mockSend([createMintAccount(), null]))

      await expect(readOnlyAccount.getTokenBalances([MOCK_TOKEN_MINT_1, MOCK_TOKEN_MINT_2]))
        .rejects.toThrow(new NoSuchElementError(`No mint account found for '${MOCK_TOKEN_MINT_2}'.`))
    })

    it('should handle RPC error from getMultipleAccounts', async () => {
      mockRpc.getMultipleAccounts.mockReturnValue({
        send: jest.fn().mockRejectedValue(new Error('RPC error: Failed to fetch accounts'))
      })

      await expect(readOnlyAccount.getTokenBalances([MOCK_TOKEN_MINT_1])).rejects.toThrow(
        'RPC error: Failed to fetch accounts'
      )
    })

    it('should pass commitment and encoding to getMultipleAccounts', async () => {
      mockMintsThenAtas([createMintAccount()], [null])

      await readOnlyAccount.getTokenBalances([MOCK_TOKEN_MINT_1])

      const [ata] = await findAssociatedTokenPda({
        mint: address(MOCK_TOKEN_MINT_1),
        owner: address(TEST_ADDRESS),
        tokenProgram: TOKEN_PROGRAM_ADDRESS
      })

      expect(mockRpc.getMultipleAccounts).toHaveBeenCalledTimes(2)
      expect(mockRpc.getMultipleAccounts).toHaveBeenNthCalledWith(1, [address(MOCK_TOKEN_MINT_1)], { commitment: 'confirmed', encoding: 'base64' })
      expect(mockRpc.getMultipleAccounts).toHaveBeenNthCalledWith(2, [ata], { commitment: 'confirmed', encoding: 'base64' })
    })

    it('should throw error for invalid token mint address', async () => {
      await expect(readOnlyAccount.getTokenBalances(['invalid-mint'])).rejects.toThrow()
    })
  })

  describe('quoteSendTransaction', () => {
    describe('TransferNativeTransaction', () => {
      beforeEach(() => {
        mockRpc.getLatestBlockhash.mockReturnValue({
          send: jest.fn().mockResolvedValue({
            value: {
              blockhash: 'HhqkdqemrKDK5Wd4oiCtzfpBWfdGS79YhLtzAck5Nz7T',
              lastValidBlockHeight: 100000n
            }
          })
        })

        mockRpc.getFeeForMessage.mockReturnValue({
          send: jest.fn().mockResolvedValue({ value: 5000n })
        })
      })

      it('should quote fee for native SOL transfer with bigint value', async () => {
        const nativeTx = {
          to: '4r33xEKAD2cNMrC9NyJy8nb4XmruUKebZ6LZZm65PVUZ',
          value: 1000000000n
        }

        const result = await readOnlyAccount.quoteSendTransaction(nativeTx)

        expect(result).toEqual({ fee: 5000n })
        expect(typeof result.fee).toBe('bigint')
        expect(mockRpc.getLatestBlockhash).toHaveBeenCalledTimes(1)
        expect(mockRpc.getFeeForMessage).toHaveBeenCalledTimes(1)
      })

      it('should quote fee for native SOL transfer with number value', async () => {
        const nativeTx = {
          to: '3gx5puA146Y1jb6dV4KS8vQnXtuXSZsAPV89JeaqfFXW',
          value: 1000000000
        }

        const result = await readOnlyAccount.quoteSendTransaction(nativeTx)

        expect(result).toEqual({ fee: 5000n })
      })

      it('should throw error for invalid recipient address', async () => {
        const invalidTx = { to: 'invalid-address', value: 1000 }

        await expect(
          readOnlyAccount.quoteSendTransaction(invalidTx)
        ).rejects.toThrow()
      })

      it('should throw error for negative value', async () => {
        const invalidTx = {
          to: '3gx5puA146Y1jb6dV4KS8vQnXtuXSZsAPV89JeaqfFXW',
          value: -1000
        }

        await expect(
          readOnlyAccount.quoteSendTransaction(invalidTx)
        ).rejects.toThrow()
      })

      it('should handle getLatestBlockhash failure', async () => {
        mockRpc.getLatestBlockhash.mockReturnValue({
          send: jest.fn().mockRejectedValue(new Error('Network error'))
        })

        const nativeTx = {
          to: '3gx5puA146Y1jb6dV4KS8vQnXtuXSZsAPV89JeaqfFXW',
          value: 1000000n
        }

        await expect(
          readOnlyAccount.quoteSendTransaction(nativeTx)
        ).rejects.toThrow('Network error')
      })

      it('should handle getFeeForMessage failure', async () => {
        mockRpc.getFeeForMessage.mockReturnValue({
          send: jest
            .fn()
            .mockRejectedValue(new Error('Failed to calculate fee'))
        })

        const nativeTx = {
          to: '3gx5puA146Y1jb6dV4KS8vQnXtuXSZsAPV89JeaqfFXW',
          value: 1000000n
        }

        await expect(
          readOnlyAccount.quoteSendTransaction(nativeTx)
        ).rejects.toThrow('Failed to calculate fee')
      })

      it('should handle null fee response', async () => {
        mockRpc.getFeeForMessage.mockReturnValue({
          send: jest.fn().mockResolvedValue({ value: null })
        })

        const nativeTx = {
          to: '3gx5puA146Y1jb6dV4KS8vQnXtuXSZsAPV89JeaqfFXW',
          value: 1000000n
        }

        await expect(
          readOnlyAccount.quoteSendTransaction(nativeTx)
        ).rejects.toThrow('Failed to calculate transaction fee')
      })
    })

    describe('SerializedTransaction', () => {
      it('should quote fee for a base64-encoded serialized transaction', async () => {
        const signingAccount = new WalletAccountSolana(
          TEST_SEED_PHRASE,
          "0'/0'/0'",
          {
            provider: TEST_RPC_URL,
            commitment: 'processed'
          }
        )

        signingAccount._rpc = mockRpc

        mockRpc.getLatestBlockhash.mockReturnValue({
          send: jest.fn().mockResolvedValue({
            value: {
              blockhash: 'HhqkdqemrKDK5Wd4oiCtzfpBWfdGS79YhLtzAck5Nz7T',
              lastValidBlockHeight: 100000n
            }
          })
        })
        mockRpc.getFeeForMessage.mockReturnValue({
          send: jest.fn().mockResolvedValue({ value: 5000n })
        })

        const transactionMessage = await signingAccount._prepareTransactionMessage({
          to: '4r33xEKAD2cNMrC9NyJy8nb4XmruUKebZ6LZZm65PVUZ',
          value: 1000000000n
        })
        const serialized = getBase64EncodedWireTransaction(
          compileTransaction(transactionMessage)
        )

        const result = await readOnlyAccount.quoteSendTransaction(serialized)

        expect(result).toEqual({ fee: 5000n })
        expect(mockRpc.getFeeForMessage).toHaveBeenCalledTimes(1)
      })
    })

    describe('TransactionMessage', () => {
      beforeEach(() => {
        mockRpc.getLatestBlockhash.mockReturnValue({
          send: jest.fn().mockResolvedValue({
            value: {
              blockhash: 'HhqkdqemrKDK5Wd4oiCtzfpBWfdGS79YhLtzAck5Nz7T',
              lastValidBlockHeight: 100000n
            }
          })
        })

        mockRpc.getFeeForMessage.mockReturnValue({
          send: jest.fn().mockResolvedValue({ value: 5000n })
        })
      })

      it('should quote fee for TransactionMessage with instructions', async () => {
        const transactionMessage = {
          version: 0,
          instructions: [
            {
              programAddress: '11111111111111111111111111111111',
              accounts: [],
              data: new Uint8Array([])
            }
          ],
          lifetimeConstraint: {
            blockhash: 'HhqkdqemrKDK5Wd4oiCtzfpBWfdGS79YhLtzAck5Nz7T',
            lastValidBlockHeight: 100000n
          }
        }

        const result =
          await readOnlyAccount.quoteSendTransaction(transactionMessage)

        expect(result).toEqual({ fee: 5000n })
        expect(mockRpc.getFeeForMessage).toHaveBeenCalledTimes(1)
      })

      it('should add lifetimeConstraint when missing from TransactionMessage', async () => {
        const transactionMessage = {
          version: 0,
          instructions: [
            {
              programAddress: '11111111111111111111111111111111',
              accounts: [],
              data: new Uint8Array([])
            }
          ]
        }

        const result =
          await readOnlyAccount.quoteSendTransaction(transactionMessage)

        expect(result).toEqual({ fee: 5000n })
        expect(mockRpc.getLatestBlockhash).toHaveBeenCalledTimes(1)
        expect(mockRpc.getLatestBlockhash).toHaveBeenCalledWith(
          expect.objectContaining({ commitment: 'confirmed' })
        )
        expect(mockRpc.getFeeForMessage).toHaveBeenCalledTimes(1)
      })

      it('should verify feePayer matches wallet address', async () => {
        const transactionMessage = {
          version: 0,
          instructions: [
            {
              programAddress: '11111111111111111111111111111111',
              accounts: [],
              data: new Uint8Array([])
            }
          ],
          feePayer: TEST_ADDRESS,
          lifetimeConstraint: {
            blockhash: 'HhqkdqemrKDK5Wd4oiCtzfpBWfdGS79YhLtzAck5Nz7T',
            lastValidBlockHeight: 100000n
          }
        }

        const result =
          await readOnlyAccount.quoteSendTransaction(transactionMessage)

        expect(result).toEqual({ fee: 5000n })
      })

      it('should throw error when feePayer does not match wallet address', async () => {
        const differentAddress = '4r33xEKAD2cNMrC9NyJy8nb4XmruUKebZ6LZZm65PVUZ'
        const transactionMessage = {
          version: 0,
          instructions: [
            {
              programAddress: '11111111111111111111111111111111',
              accounts: [],
              data: new Uint8Array([])
            }
          ],
          feePayer: differentAddress,
          lifetimeConstraint: {
            blockhash: 'HhqkdqemrKDK5Wd4oiCtzfpBWfdGS79YhLtzAck5Nz7T',
            lastValidBlockHeight: 100000n
          }
        }

        await expect(
          readOnlyAccount.quoteSendTransaction(transactionMessage)
        ).rejects.toThrow(
          `Transaction fee payer (${differentAddress}) does not match wallet address (${TEST_ADDRESS})`
        )

        expect(mockRpc.getFeeForMessage).not.toHaveBeenCalled()
      })

      it('should add feePayer when missing from TransactionMessage', async () => {
        const transactionMessage = {
          version: 0,
          instructions: [
            {
              programAddress: '11111111111111111111111111111111',
              accounts: [],
              data: new Uint8Array([])
            }
          ],
          lifetimeConstraint: {
            blockhash: 'HhqkdqemrKDK5Wd4oiCtzfpBWfdGS79YhLtzAck5Nz7T',
            lastValidBlockHeight: 100000n
          }
        }

        const result =
          await readOnlyAccount.quoteSendTransaction(transactionMessage)

        expect(result).toEqual({ fee: 5000n })
        expect(mockRpc.getFeeForMessage).toHaveBeenCalledTimes(1)
      })

      it('should handle RPC error when fetching latest blockhash for TransactionMessage', async () => {
        mockRpc.getLatestBlockhash.mockReturnValue({
          send: jest
            .fn()
            .mockRejectedValue(new Error('Blockhash fetch failed'))
        })

        const transactionMessage = {
          version: 0,
          instructions: [
            {
              programAddress: '11111111111111111111111111111111',
              accounts: [],
              data: new Uint8Array([])
            }
          ]
        }

        await expect(
          readOnlyAccount.quoteSendTransaction(transactionMessage)
        ).rejects.toThrow('Blockhash fetch failed')
      })

      it('should handle RPC error when calculating fee for TransactionMessage', async () => {
        mockRpc.getFeeForMessage.mockReturnValue({
          send: jest
            .fn()
            .mockRejectedValue(new Error('Fee calculation failed'))
        })

        const transactionMessage = {
          version: 0,
          instructions: [
            {
              programAddress: '11111111111111111111111111111111',
              accounts: [],
              data: new Uint8Array([])
            }
          ],
          feePayer: TEST_ADDRESS,
          lifetimeConstraint: {
            blockhash: 'HhqkdqemrKDK5Wd4oiCtzfpBWfdGS79YhLtzAck5Nz7T',
            lastValidBlockHeight: 100000n
          }
        }

        await expect(
          readOnlyAccount.quoteSendTransaction(transactionMessage)
        ).rejects.toThrow('Fee calculation failed')
      })

      it('should throw error when getFeeForMessage returns null for TransactionMessage', async () => {
        mockRpc.getFeeForMessage.mockReturnValue({
          send: jest.fn().mockResolvedValue({ value: null })
        })

        const transactionMessage = {
          version: 0,
          instructions: [
            {
              programAddress: '11111111111111111111111111111111',
              accounts: [],
              data: new Uint8Array([])
            }
          ],
          feePayer: TEST_ADDRESS,
          lifetimeConstraint: {
            blockhash: 'HhqkdqemrKDK5Wd4oiCtzfpBWfdGS79YhLtzAck5Nz7T',
            lastValidBlockHeight: 100000n
          }
        }

        await expect(
          readOnlyAccount.quoteSendTransaction(transactionMessage)
        ).rejects.toThrow('Failed to calculate transaction fee')
      })
    })

    describe('Error Handling', () => {
      it('should throw error when not connected to provider', async () => {
        const disconnectedAccount = new WalletAccountReadOnlySolana(
          TEST_ADDRESS,
          {}
        )
        const tx = {
          to: '3gx5puA146Y1jb6dV4KS8vQnXtuXSZsAPV89JeaqfFXW',
          value: 1000n
        }

        await expect(
          disconnectedAccount.quoteSendTransaction(tx)
        ).rejects.toThrow(
          'The wallet must be connected to a provider to quote transactions.'
        )
      })
    })
  })

  describe('quoteTransfer transaction construction', () => {
    const CLASSIC_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'
    const TOKEN_2022_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
    const RECIPIENT = '3uXqWpwgqKVdiHAwF6Vmu4G4vdQzpR66xjPkz1G7zMKE'
    const TRANSFER_CHECKED_DISCRIMINATOR = 12

    beforeEach(() => {
      mockRpc.getLatestBlockhash.mockReturnValue(mockSend({
        blockhash: 'HhqkdqemrKDK5Wd4oiCtzfpBWfdGS79YhLtzAck5Nz7T',
        lastValidBlockHeight: 100000n
      }))
      mockRpc.getFeeForMessage.mockReturnValue(mockSend(5000n))
      mockRpc.getMinimumBalanceForRentExemption.mockImplementation(size => ({
        send: jest.fn().mockResolvedValue(rentFor(size))
      }))
    })

    function quote (token, amount) {
      return readOnlyAccount.quoteTransfer({ token, recipient: RECIPIENT, amount })
    }

    it('should quote a transferChecked instruction for a classic SPL mint', async () => {
      mockRpc.getMultipleAccounts.mockReturnValue(mockSend([createMintAccount(TOKEN_PROGRAM_ADDRESS, { decimals: 6 })]))
      mockRpc.getAccountInfo.mockReturnValue(mockSend(createTokenAccount(0)))

      await quote(CLASSIC_MINT, 1000000n)

      const [fromAta] = await findAssociatedTokenPda({
        mint: address(CLASSIC_MINT),
        owner: address(TEST_ADDRESS),
        tokenProgram: TOKEN_PROGRAM_ADDRESS
      })
      const [toAta] = await findAssociatedTokenPda({
        mint: address(CLASSIC_MINT),
        owner: address(RECIPIENT),
        tokenProgram: TOKEN_PROGRAM_ADDRESS
      })

      const instructions = decodeQuotedInstructions(mockRpc.getFeeForMessage)

      expect(instructions).toHaveLength(1)
      const [transfer] = instructions
      expect(transfer.programAddress).toBe(TOKEN_PROGRAM_ADDRESS)
      expect(transfer.accounts).toEqual([fromAta, address(CLASSIC_MINT), toAta, address(TEST_ADDRESS)])
      expect(transfer.data[0]).toBe(TRANSFER_CHECKED_DISCRIMINATOR)
      expect(transfer.data[transfer.data.length - 1]).toBe(6)
    })

    it('should quote the transfer against the token extensions program for a Token-2022 mint', async () => {
      mockRpc.getMultipleAccounts.mockReturnValue(mockSend([
        createMintAccount(TOKEN_2022_PROGRAM_ADDRESS, { size: 278, accountType: ACCOUNT_TYPE_MINT, decimals: 9 })
      ]))
      mockRpc.getAccountInfo.mockReturnValue(mockSend(createTokenAccount(0, TOKEN_2022_PROGRAM_ADDRESS, { extensions: [] })))

      await quote(TOKEN_2022_MINT, 5n)

      const [fromAta] = await findAssociatedTokenPda({
        mint: address(TOKEN_2022_MINT),
        owner: address(TEST_ADDRESS),
        tokenProgram: TOKEN_2022_PROGRAM_ADDRESS
      })
      const [toAta] = await findAssociatedTokenPda({
        mint: address(TOKEN_2022_MINT),
        owner: address(RECIPIENT),
        tokenProgram: TOKEN_2022_PROGRAM_ADDRESS
      })

      const instructions = decodeQuotedInstructions(mockRpc.getFeeForMessage)

      expect(instructions).toHaveLength(1)
      const [transfer] = instructions
      expect(transfer.programAddress).toBe(TOKEN_2022_PROGRAM_ADDRESS)
      expect(transfer.accounts).toEqual([fromAta, address(TOKEN_2022_MINT), toAta, address(TEST_ADDRESS)])
      expect(transfer.data[transfer.data.length - 1]).toBe(9)
    })

    it('should quote the creation of the recipient ATA under the mint own token program', async () => {
      mockRpc.getMultipleAccounts.mockReturnValue(mockSend([
        createMintAccount(TOKEN_2022_PROGRAM_ADDRESS, { size: 278, accountType: ACCOUNT_TYPE_MINT, decimals: 9 })
      ]))
      mockRpc.getAccountInfo.mockReturnValue(mockSend(null))

      await quote(TOKEN_2022_MINT, 5n)

      const [toAta] = await findAssociatedTokenPda({
        mint: address(TOKEN_2022_MINT),
        owner: address(RECIPIENT),
        tokenProgram: TOKEN_2022_PROGRAM_ADDRESS
      })

      const instructions = decodeQuotedInstructions(mockRpc.getFeeForMessage)

      expect(instructions).toHaveLength(2)
      const [createAta] = instructions
      expect(createAta.programAddress).toBe(ASSOCIATED_TOKEN_PROGRAM_ADDRESS)
      expect(createAta.accounts).toEqual([
        address(TEST_ADDRESS),
        toAta,
        address(RECIPIENT),
        address(TOKEN_2022_MINT),
        '11111111111111111111111111111111',
        TOKEN_2022_PROGRAM_ADDRESS
      ])
    })

    it('should not quote the creation of the recipient ATA when it already exists', async () => {
      mockRpc.getMultipleAccounts.mockReturnValue(mockSend([createMintAccount(TOKEN_PROGRAM_ADDRESS, { decimals: 6 })]))
      mockRpc.getAccountInfo.mockReturnValue(mockSend(createTokenAccount(0)))

      await quote(CLASSIC_MINT, 1n)

      expect(decodeQuotedInstructions(mockRpc.getFeeForMessage)).toHaveLength(1)
    })

    it('should throw ValueError when the amount exceeds the u64 maximum', async () => {
      await expect(quote(CLASSIC_MINT, 2n ** 64n)).rejects.toThrow(new ValueError('Amount exceeds u64 maximum value'))
    })

    it('should throw ValueError when a number amount exceeds the safe integer range', async () => {
      await expect(quote(CLASSIC_MINT, Number.MAX_SAFE_INTEGER + 2)).rejects.toThrow(new ValueError('Amount exceeds safe integer range'))
    })
  })

  describe('quoteTransfer token extension policy', () => {
    const TOKEN_2022_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
    const CLASSIC_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'
    const RECIPIENT = '3uXqWpwgqKVdiHAwF6Vmu4G4vdQzpR66xjPkz1G7zMKE'
    const SYSTEM_PROGRAM = '11111111111111111111111111111111'

    beforeEach(() => {
      mockRpc.getLatestBlockhash.mockReturnValue(mockSend({
        blockhash: 'HhqkdqemrKDK5Wd4oiCtzfpBWfdGS79YhLtzAck5Nz7T',
        lastValidBlockHeight: 100000n
      }))
      mockRpc.getFeeForMessage.mockReturnValue(mockSend(5000n))
      mockRpc.getEpochInfo.mockReturnValue({ send: jest.fn().mockResolvedValue({ epoch: 0n }) })
      mockRpc.getAccountInfo.mockReturnValue(mockSend(createTokenAccount(0, TOKEN_2022_PROGRAM_ADDRESS, { extensions: [] })))
    })

    function mockMintWithExtensions (extensions) {
      mockRpc.getMultipleAccounts.mockReturnValue(mockSend([
        createMintAccount(TOKEN_2022_PROGRAM_ADDRESS, { decimals: 6, extensions })
      ]))
    }

    function quote (mint = TOKEN_2022_MINT, solanaOptions) {
      return readOnlyAccount.quoteTransfer({ token: mint, recipient: RECIPIENT, amount: 1000n }, solanaOptions)
    }

    function quotedPrograms () {
      return decodeQuotedInstructions(mockRpc.getFeeForMessage).map(instruction => instruction.programAddress)
    }

    it('should reject a non-transferable mint', async () => {
      mockMintWithExtensions([{ __kind: 'NonTransferable' }])

      await expect(quote()).rejects.toThrow(new NonTransferableTokenError(`Token '${TOKEN_2022_MINT}' is non-transferable.`))
    })

    it('should reject a mint carrying a transfer hook with a hook program set', async () => {
      mockMintWithExtensions([
        { __kind: 'TransferHook', authority: address(SYSTEM_PROGRAM), programId: LEGACY_MEMO_PROGRAM_ADDRESS_V3 }
      ])

      await expect(quote()).rejects.toThrow(new TransferHookNotSupportedError(
        `Token '${TOKEN_2022_MINT}' carries a transfer hook, which is not supported.`
      ))
      expect(mockRpc.getFeeForMessage).not.toHaveBeenCalled()
    })

    it('should accept a mint carrying a transfer hook with no hook program set', async () => {
      mockMintWithExtensions([
        { __kind: 'TransferHook', authority: address(SYSTEM_PROGRAM), programId: address(SYSTEM_PROGRAM) }
      ])

      await quote()

      expect(quotedPrograms()).toEqual([TOKEN_2022_PROGRAM_ADDRESS])
    })

    it('should reject a mint configured for confidential transfers', async () => {
      mockMintWithExtensions([
        {
          __kind: 'ConfidentialTransferMint',
          authority: { __option: 'None' },
          autoApproveNewAccounts: false,
          auditorElgamalPubkey: { __option: 'None' }
        }
      ])

      await expect(quote()).rejects.toThrow(new ConfidentialTransferNotSupportedError(
        `Token '${TOKEN_2022_MINT}' is configured for confidential transfers, which are not supported.`
      ))
    })

    it('should reject a mint configured for confidential minting and burning', async () => {
      mockMintWithExtensions([
        {
          __kind: 'ConfidentialTransferMint',
          authority: { __option: 'None' },
          autoApproveNewAccounts: false,
          auditorElgamalPubkey: { __option: 'None' }
        },
        {
          __kind: 'ConfidentialMintBurn',
          confidentialSupply: new Uint8Array(64),
          decryptableSupply: new Uint8Array(36),
          supplyElgamalPubkey: address(SYSTEM_PROGRAM),
          pendingBurn: new Uint8Array(64)
        }
      ])

      await expect(quote()).rejects.toThrow(new ConfidentialTransferNotSupportedError(
        `Token '${TOKEN_2022_MINT}' is configured for confidential transfers, which are not supported.`
      ))
    })

    it('should reject a mint that freezes the accounts it creates when the recipient account must be created', async () => {
      mockMintWithExtensions([{ __kind: 'DefaultAccountState', state: AccountState2022.Frozen }])
      mockRpc.getAccountInfo.mockReturnValue(mockSend(null))

      await expect(quote()).rejects.toThrow(new FrozenTokenAccountError(
        `Token '${TOKEN_2022_MINT}' freezes by default the accounts it creates, so '${RECIPIENT}' could not receive it.`
      ))
      expect(mockRpc.getFeeForMessage).not.toHaveBeenCalled()
    })

    it('should accept a mint that freezes the accounts it creates when the recipient account exists unfrozen', async () => {
      mockMintWithExtensions([{ __kind: 'DefaultAccountState', state: AccountState2022.Frozen }])

      await quote()

      expect(quotedPrograms()).toEqual([TOKEN_2022_PROGRAM_ADDRESS])
    })

    it('should accept a mint whose default account state is initialized', async () => {
      mockMintWithExtensions([{ __kind: 'DefaultAccountState', state: AccountState2022.Initialized }])

      await quote()

      expect(quotedPrograms()).toEqual([TOKEN_2022_PROGRAM_ADDRESS])
    })

    it('should transfer the requested amount gross for a fee-bearing mint', async () => {
      mockMintWithExtensions([
        {
          __kind: 'TransferFeeConfig',
          transferFeeConfigAuthority: address(SYSTEM_PROGRAM),
          withdrawWithheldAuthority: address(SYSTEM_PROGRAM),
          withheldAmount: 0n,
          olderTransferFee: { epoch: 0n, maximumFee: 100n, transferFeeBasisPoints: 100 },
          newerTransferFee: { epoch: 0n, maximumFee: 100n, transferFeeBasisPoints: 100 }
        }
      ])

      await quote()

      const [transfer] = decodeQuotedInstructions(mockRpc.getFeeForMessage)
      expect(Buffer.from(transfer.data).readBigUInt64LE(1)).toBe(1000n)
    })

    it('should accept an interest-bearing mint', async () => {
      mockMintWithExtensions([
        {
          __kind: 'InterestBearingConfig',
          rateAuthority: address(SYSTEM_PROGRAM),
          initializationTimestamp: 0n,
          preUpdateAverageRate: 0,
          lastUpdateTimestamp: 0n,
          currentRate: 0
        }
      ])

      await quote()

      expect(quotedPrograms()).toEqual([TOKEN_2022_PROGRAM_ADDRESS])
    })

    it('should reject a frozen recipient account', async () => {
      mockMintWithExtensions([])
      mockRpc.getAccountInfo.mockReturnValue(mockSend(
        createTokenAccount(0, TOKEN_2022_PROGRAM_ADDRESS, { state: AccountState2022.Frozen, extensions: [] })
      ))

      await expect(quote()).rejects.toThrow(new FrozenTokenAccountError(`The token account of '${RECIPIENT}' is frozen.`))
    })

    it('should attach the memo before the transfer to a recipient account requiring a memo', async () => {
      mockMintWithExtensions([])
      mockRpc.getAccountInfo.mockReturnValue(mockSend(
        createTokenAccount(0, TOKEN_2022_PROGRAM_ADDRESS, {
          extensions: [{ __kind: 'MemoTransfer', requireIncomingTransferMemos: true }]
        })
      ))

      await quote(TOKEN_2022_MINT, { memo: 'wdk memo' })

      expect(quotedPrograms()).toEqual([LEGACY_MEMO_PROGRAM_ADDRESS_V3, TOKEN_2022_PROGRAM_ADDRESS])
    })

    it('should quote a transfer without a memo to a recipient account requiring a memo', async () => {
      mockMintWithExtensions([])
      mockRpc.getAccountInfo.mockReturnValue(mockSend(
        createTokenAccount(0, TOKEN_2022_PROGRAM_ADDRESS, {
          extensions: [{ __kind: 'MemoTransfer', requireIncomingTransferMemos: true }]
        })
      ))

      await quote()

      expect(quotedPrograms()).toEqual([TOKEN_2022_PROGRAM_ADDRESS])
    })

    it('should not inspect extensions of a classic SPL mint', async () => {
      mockRpc.getMultipleAccounts.mockReturnValue(mockSend([createMintAccount(TOKEN_PROGRAM_ADDRESS, { decimals: 6 })]))
      mockRpc.getAccountInfo.mockReturnValue(mockSend(createTokenAccount(0)))

      await quote(CLASSIC_MINT)

      expect(quotedPrograms()).toEqual([TOKEN_PROGRAM_ADDRESS])
    })

    it('should quote a transfer of a classic SPL mint to a frozen recipient account', async () => {
      mockRpc.getMultipleAccounts.mockReturnValue(mockSend([createMintAccount(TOKEN_PROGRAM_ADDRESS, { decimals: 6 })]))
      mockRpc.getAccountInfo.mockReturnValue(mockSend(createTokenAccount(0, TOKEN_PROGRAM_ADDRESS, { state: AccountState2022.Frozen })))

      await quote(CLASSIC_MINT)

      expect(quotedPrograms()).toEqual([TOKEN_PROGRAM_ADDRESS])
    })
  })

  describe('quoteTransfer', () => {
    const MOCK_TOKEN_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'
    const MOCK_RECIPIENT = 'HmWPZeFgxZAJQYgwh5ipYwjbVTHtjEHB3dnJ5xcQBHX9'

    beforeEach(() => {
      mockRpc.getMultipleAccounts.mockReturnValue(mockSend([createMintAccount(TOKEN_PROGRAM_ADDRESS, { decimals: 6 })]))
      mockRpc.getMinimumBalanceForRentExemption.mockImplementation(size => ({
        send: jest.fn().mockResolvedValue(rentFor(size))
      }))
      mockRpc.getLatestBlockhash.mockReturnValue({
        send: jest.fn().mockResolvedValue({
          value: {
            blockhash: 'HhqkdqemrKDK5Wd4oiCtzfpBWfdGS79YhLtzAck5Nz7T',
            lastValidBlockHeight: 100000n
          }
        })
      })
    })

    it('should quote fee when recipient ATA exists', async () => {
      mockRpc.getAccountInfo
        .mockReturnValueOnce({
          send: jest.fn().mockResolvedValue({
            value: {
              owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
              lamports: 2039280n,
              data: [Buffer.alloc(165).toString('base64'), 'base64']
            }
          })
        })
        .mockReturnValueOnce({
          send: jest.fn().mockResolvedValue({
            value: {
              owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
              lamports: 2039280n,
              data: [Buffer.alloc(165).toString('base64'), 'base64']
            }
          })
        })
        .mockReturnValueOnce({
          send: jest.fn().mockResolvedValue({
            value: {
              owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
              lamports: 2039280n,
              data: [Buffer.alloc(82).toString('base64'), 'base64']
            }
          })
        })

      mockRpc.getFeeForMessage.mockReturnValue({
        send: jest.fn().mockResolvedValue({ value: 5000n })
      })

      const result = await readOnlyAccount.quoteTransfer({
        token: MOCK_TOKEN_MINT,
        recipient: MOCK_RECIPIENT,
        amount: 1000000n
      })

      expect(result).toEqual({ fee: 5000n, rent: 0n, transferFee: 0n })
    })

    it('should attach the memo before the transfer instruction', async () => {
      // 'wdk memo' encoded as UTF-8.
      const EXPECTED_MEMO_DATA = new Uint8Array([119, 100, 107, 32, 109, 101, 109, 111])

      mockRpc.getAccountInfo.mockReturnValue({
        send: jest.fn().mockResolvedValue({
          value: {
            owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
            lamports: 2039280n,
            data: [Buffer.alloc(165).toString('base64'), 'base64']
          }
        })
      })

      mockRpc.getFeeForMessage.mockReturnValue({
        send: jest.fn().mockResolvedValue({ value: 5000n })
      })

      const result = await readOnlyAccount.quoteTransfer(
        {
          token: MOCK_TOKEN_MINT,
          recipient: MOCK_RECIPIENT,
          amount: 1000000n
        },
        { memo: 'wdk memo' }
      )

      const [base64EncodedMessage] = mockRpc.getFeeForMessage.mock.calls[0]
      const compiledMessage = getCompiledTransactionMessageDecoder()
        .decode(getBase64Encoder().encode(base64EncodedMessage))
      const programs = compiledMessage.instructions.map(
        (instruction) => compiledMessage.staticAccounts[instruction.programAddressIndex]
      )

      expect(programs).toEqual([LEGACY_MEMO_PROGRAM_ADDRESS_V3, TOKEN_PROGRAM_ADDRESS])
      expect(compiledMessage.instructions[0].data).toEqual(EXPECTED_MEMO_DATA)
      expect(result).toEqual({ fee: 5000n, rent: 0n, transferFee: 0n })
    })

    it('should attach the memo after the ATA creation and before the transfer', async () => {
      // 'wdk memo' encoded as UTF-8.
      const EXPECTED_MEMO_DATA = new Uint8Array([119, 100, 107, 32, 109, 101, 109, 111])

      mockRpc.getAccountInfo.mockReturnValue({
        send: jest.fn().mockResolvedValue({ value: null })
      })

      mockRpc.getFeeForMessage.mockReturnValue({
        send: jest.fn().mockResolvedValue({ value: 7000n })
      })

      const result = await readOnlyAccount.quoteTransfer(
        {
          token: MOCK_TOKEN_MINT,
          recipient: MOCK_RECIPIENT,
          amount: 1000000n
        },
        { memo: 'wdk memo' }
      )

      const [base64EncodedMessage] = mockRpc.getFeeForMessage.mock.calls[0]
      const compiledMessage = getCompiledTransactionMessageDecoder()
        .decode(getBase64Encoder().encode(base64EncodedMessage))
      const programs = compiledMessage.instructions.map(
        (instruction) => compiledMessage.staticAccounts[instruction.programAddressIndex]
      )

      expect(programs).toEqual([
        ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
        LEGACY_MEMO_PROGRAM_ADDRESS_V3,
        TOKEN_PROGRAM_ADDRESS
      ])
      expect(compiledMessage.instructions[1].data).toEqual(EXPECTED_MEMO_DATA)
      expect(result).toEqual({ fee: 7000n, rent: rentFor(165), transferFee: 0n })
    })

    it('should quote a transfer when the Solana options are null', async () => {
      mockRpc.getAccountInfo.mockReturnValue({
        send: jest.fn().mockResolvedValue({
          value: {
            owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
            lamports: 2039280n,
            data: [Buffer.alloc(165).toString('base64'), 'base64']
          }
        })
      })

      mockRpc.getFeeForMessage.mockReturnValue({
        send: jest.fn().mockResolvedValue({ value: 5000n })
      })

      const result = await readOnlyAccount.quoteTransfer(
        {
          token: MOCK_TOKEN_MINT,
          recipient: MOCK_RECIPIENT,
          amount: 1000000n
        },
        null
      )

      const [base64EncodedMessage] = mockRpc.getFeeForMessage.mock.calls[0]
      const compiledMessage = getCompiledTransactionMessageDecoder()
        .decode(getBase64Encoder().encode(base64EncodedMessage))
      const programs = compiledMessage.instructions.map(
        (instruction) => compiledMessage.staticAccounts[instruction.programAddressIndex]
      )

      expect(programs).toEqual([TOKEN_PROGRAM_ADDRESS])
      expect(result).toEqual({ fee: 5000n, rent: 0n, transferFee: 0n })
    })

    it('should throw when the memo is not a string', async () => {
      await expect(
        readOnlyAccount.quoteTransfer(
          {
            token: MOCK_TOKEN_MINT,
            recipient: MOCK_RECIPIENT,
            amount: 1000000n
          },
          { memo: 1000 }
        )
      ).rejects.toThrow('Memo must be a string')

      expect(mockRpc.getAccountInfo).not.toHaveBeenCalled()
      expect(mockRpc.getFeeForMessage).not.toHaveBeenCalled()
    })

    it('should throw when the memo makes the transaction too large', async () => {
      mockRpc.getAccountInfo.mockReturnValue({
        send: jest.fn().mockResolvedValue({
          value: {
            owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
            lamports: 2039280n,
            data: [Buffer.alloc(165).toString('base64'), 'base64']
          }
        })
      })

      await expect(
        readOnlyAccount.quoteTransfer(
          {
            token: MOCK_TOKEN_MINT,
            recipient: MOCK_RECIPIENT,
            amount: 1000000n
          },
          { memo: 'x'.repeat(1000) }
        )
      ).rejects.toThrow('The transfer transaction is 1285 bytes, over the 1232 bytes limit. Shorten the memo.')

      expect(mockRpc.getFeeForMessage).not.toHaveBeenCalled()
    })

    it('should not attach a memo when the memo is empty', async () => {
      mockRpc.getAccountInfo.mockReturnValue({
        send: jest.fn().mockResolvedValue({
          value: {
            owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
            lamports: 2039280n,
            data: [Buffer.alloc(165).toString('base64'), 'base64']
          }
        })
      })

      mockRpc.getFeeForMessage.mockReturnValue({
        send: jest.fn().mockResolvedValue({ value: 5000n })
      })

      const result = await readOnlyAccount.quoteTransfer(
        {
          token: MOCK_TOKEN_MINT,
          recipient: MOCK_RECIPIENT,
          amount: 1000000n
        },
        { memo: '' }
      )

      const [base64EncodedMessage] = mockRpc.getFeeForMessage.mock.calls[0]
      const compiledMessage = getCompiledTransactionMessageDecoder()
        .decode(getBase64Encoder().encode(base64EncodedMessage))
      const programs = compiledMessage.instructions.map(
        (instruction) => compiledMessage.staticAccounts[instruction.programAddressIndex]
      )

      expect(programs).toEqual([TOKEN_PROGRAM_ADDRESS])
      expect(result).toEqual({ fee: 5000n, rent: 0n, transferFee: 0n })
    })

    it('should not attach a memo when the transfer carries none', async () => {
      mockRpc.getAccountInfo.mockReturnValue({
        send: jest.fn().mockResolvedValue({
          value: {
            owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
            lamports: 2039280n,
            data: [Buffer.alloc(165).toString('base64'), 'base64']
          }
        })
      })

      mockRpc.getFeeForMessage.mockReturnValue({
        send: jest.fn().mockResolvedValue({ value: 5000n })
      })

      const result = await readOnlyAccount.quoteTransfer({
        token: MOCK_TOKEN_MINT,
        recipient: MOCK_RECIPIENT,
        amount: 1000000n
      })

      const [base64EncodedMessage] = mockRpc.getFeeForMessage.mock.calls[0]
      const compiledMessage = getCompiledTransactionMessageDecoder()
        .decode(getBase64Encoder().encode(base64EncodedMessage))
      const programs = compiledMessage.instructions.map(
        (instruction) => compiledMessage.staticAccounts[instruction.programAddressIndex]
      )

      expect(programs).toEqual([TOKEN_PROGRAM_ADDRESS])
      expect(result).toEqual({ fee: 5000n, rent: 0n, transferFee: 0n })
    })

    it('should quote fee when recipient ATA does not exist', async () => {
      mockRpc.getAccountInfo
        .mockReturnValueOnce({
          send: jest.fn().mockResolvedValue({ value: null })
        })
        .mockReturnValueOnce({
          send: jest.fn().mockResolvedValue({
            value: {
              owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
              lamports: 2039280n,
              data: [Buffer.alloc(165).toString('base64'), 'base64']
            }
          })
        })
        .mockReturnValueOnce({
          send: jest.fn().mockResolvedValue({
            value: {
              owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
              lamports: 2039280n,
              data: [Buffer.alloc(82).toString('base64'), 'base64']
            }
          })
        })

      mockRpc.getFeeForMessage.mockReturnValue({
        send: jest.fn().mockResolvedValue({ value: 7000n })
      })

      const result = await readOnlyAccount.quoteTransfer({
        token: MOCK_TOKEN_MINT,
        recipient: MOCK_RECIPIENT,
        amount: 1000000n
      })

      expect(result).toEqual({ fee: 7000n, rent: rentFor(165), transferFee: 0n })
      expect(mockRpc.getMinimumBalanceForRentExemption).toHaveBeenCalledWith(165n, { commitment: 'confirmed' })
    })

    it('should handle number amount', async () => {
      mockRpc.getAccountInfo
        .mockReturnValueOnce({
          send: jest.fn().mockResolvedValue({
            value: {
              owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
              lamports: 2039280n,
              data: [Buffer.alloc(165).toString('base64'), 'base64']
            }
          })
        })
        .mockReturnValueOnce({
          send: jest.fn().mockResolvedValue({
            value: {
              owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
              lamports: 2039280n,
              data: [Buffer.alloc(165).toString('base64'), 'base64']
            }
          })
        })
        .mockReturnValueOnce({
          send: jest.fn().mockResolvedValue({
            value: {
              owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
              lamports: 2039280n,
              data: [Buffer.alloc(82).toString('base64'), 'base64']
            }
          })
        })

      mockRpc.getFeeForMessage.mockReturnValue({
        send: jest.fn().mockResolvedValue({ value: 5000n })
      })

      const result = await readOnlyAccount.quoteTransfer({
        token: MOCK_TOKEN_MINT,
        recipient: MOCK_RECIPIENT,
        amount: 1000000
      })

      expect(result.fee).toBe(5000n)
    })

    it('should throw error when not connected to provider', async () => {
      const disconnectedAccount = new WalletAccountReadOnlySolana(
        TEST_ADDRESS,
        {}
      )

      await expect(
        disconnectedAccount.quoteTransfer({
          token: MOCK_TOKEN_MINT,
          recipient: MOCK_RECIPIENT,
          amount: 1000000n
        })
      ).rejects.toThrow(
        'The wallet must be connected to a provider to quote transfer operations.'
      )
    })

    it('should throw error when getFeeForMessage returns null', async () => {
      mockRpc.getAccountInfo
        .mockReturnValueOnce({
          send: jest.fn().mockResolvedValue({ value: null })
        })
        .mockReturnValueOnce({
          send: jest.fn().mockResolvedValue({
            value: {
              owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
              lamports: 2039280n,
              data: [Buffer.alloc(165).toString('base64'), 'base64']
            }
          })
        })
        .mockReturnValueOnce({
          send: jest.fn().mockResolvedValue({
            value: {
              owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
              lamports: 2039280n,
              data: [Buffer.alloc(82).toString('base64'), 'base64']
            }
          })
        })

      mockRpc.getFeeForMessage.mockReturnValue({
        send: jest.fn().mockResolvedValue({ value: null })
      })

      await expect(
        readOnlyAccount.quoteTransfer({
          token: MOCK_TOKEN_MINT,
          recipient: MOCK_RECIPIENT,
          amount: 1000000n
        })
      ).rejects.toThrow('Failed to calculate transaction fee')
    })
  })

  describe('quoteTransfer of a Token-2022 mint', () => {
    const TOKEN_2022_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
    const RECIPIENT = '3uXqWpwgqKVdiHAwF6Vmu4G4vdQzpR66xjPkz1G7zMKE'
    const CURRENT_EPOCH = 500n

    function transferFeeConfig ({ older = { epoch: 0n, maximumFee: 0n, transferFeeBasisPoints: 0 }, newer }) {
      return {
        __kind: 'TransferFeeConfig',
        transferFeeConfigAuthority: address(TEST_ADDRESS),
        withdrawWithheldAuthority: address(TEST_ADDRESS),
        withheldAmount: 0n,
        olderTransferFee: older,
        newerTransferFee: newer
      }
    }

    function mockMint (extensions) {
      mockRpc.getMultipleAccounts.mockReturnValue(mockSend([
        createMintAccount(TOKEN_2022_PROGRAM_ADDRESS, { decimals: 6, extensions })
      ]))
    }

    function mockRecipientAccount (exists) {
      mockRpc.getAccountInfo.mockReturnValue(mockSend(
        exists ? createTokenAccount(0, TOKEN_2022_PROGRAM_ADDRESS, { extensions: [] }) : null
      ))
    }

    function quote (amount = 1000000n) {
      return readOnlyAccount.quoteTransfer({ token: TOKEN_2022_MINT, recipient: RECIPIENT, amount })
    }

    beforeEach(() => {
      mockRpc.getLatestBlockhash.mockReturnValue(mockSend({
        blockhash: 'HhqkdqemrKDK5Wd4oiCtzfpBWfdGS79YhLtzAck5Nz7T',
        lastValidBlockHeight: 100000n
      }))
      mockRpc.getFeeForMessage.mockReturnValue(mockSend(5000n))
      mockRpc.getMinimumBalanceForRentExemption.mockImplementation(size => ({
        send: jest.fn().mockResolvedValue(rentFor(size))
      }))
      mockRpc.getEpochInfo.mockReturnValue({
        send: jest.fn().mockResolvedValue({ epoch: CURRENT_EPOCH })
      })
    })

    it('should quote no rent and no transfer fee for a bare mint and an existing recipient account', async () => {
      mockMint([])
      mockRecipientAccount(true)

      const result = await quote()

      expect(result).toEqual({ fee: 5000n, rent: 0n, transferFee: 0n })
      expect(mockRpc.getMinimumBalanceForRentExemption).not.toHaveBeenCalled()
      expect(mockRpc.getEpochInfo).not.toHaveBeenCalled()
    })

    it('should quote the rent of an immutable-owner account when creating the recipient account of a bare mint', async () => {
      mockMint([])
      mockRecipientAccount(false)

      const result = await quote()

      expect(result).toEqual({ fee: 5000n, rent: rentFor(170), transferFee: 0n })
      expect(mockRpc.getMinimumBalanceForRentExemption).toHaveBeenCalledWith(170n, { commitment: 'confirmed' })
    })

    it('should quote the rent of the transfer fee amount extension when creating the recipient account of a fee-bearing mint', async () => {
      mockMint([transferFeeConfig({ newer: { epoch: 0n, maximumFee: 1000000n, transferFeeBasisPoints: 50 } })])
      mockRecipientAccount(false)

      const result = await quote()

      expect(result.rent).toBe(rentFor(182))
    })

    it('should quote the rent of the transfer hook account extension when creating the recipient account of a mint with an unset transfer hook', async () => {
      mockMint([{ __kind: 'TransferHook', authority: address(TEST_ADDRESS), programId: address('11111111111111111111111111111111') }])
      mockRecipientAccount(false)

      const result = await quote()

      expect(result).toEqual({ fee: 5000n, rent: rentFor(175), transferFee: 0n })
      expect(mockRpc.getMinimumBalanceForRentExemption).toHaveBeenCalledWith(175n, { commitment: 'confirmed' })
    })

    it('should quote the rent of the pausable account extension when creating the recipient account of a pausable mint', async () => {
      mockMint([{ __kind: 'PausableConfig', authority: null, paused: false }])
      mockRecipientAccount(false)

      const result = await quote()

      expect(result.rent).toBe(rentFor(174))
    })

    it('should quote the transfer fee at the newer rate once its epoch is reached', async () => {
      mockMint([transferFeeConfig({
        older: { epoch: 0n, maximumFee: 1000000n, transferFeeBasisPoints: 10 },
        newer: { epoch: CURRENT_EPOCH, maximumFee: 1000000n, transferFeeBasisPoints: 50 }
      })])
      mockRecipientAccount(true)

      const result = await quote(1000000n)

      expect(result).toEqual({ fee: 5000n, rent: 0n, transferFee: 5000n })
      expect(mockRpc.getEpochInfo).toHaveBeenCalledWith({ commitment: 'confirmed' })
    })

    it('should quote the transfer fee at the older rate before the newer epoch', async () => {
      mockMint([transferFeeConfig({
        older: { epoch: 0n, maximumFee: 1000000n, transferFeeBasisPoints: 10 },
        newer: { epoch: CURRENT_EPOCH + 1n, maximumFee: 1000000n, transferFeeBasisPoints: 50 }
      })])
      mockRecipientAccount(true)

      const result = await quote(1000000n)

      expect(result.transferFee).toBe(1000n)
    })

    it('should round the transfer fee up', async () => {
      mockMint([transferFeeConfig({ newer: { epoch: 0n, maximumFee: 1000000n, transferFeeBasisPoints: 50 } })])
      mockRecipientAccount(true)

      const result = await quote(1001n)

      expect(result.transferFee).toBe(6n)
    })

    it('should cap the transfer fee at the maximum fee', async () => {
      mockMint([transferFeeConfig({ newer: { epoch: 0n, maximumFee: 2500n, transferFeeBasisPoints: 50 } })])
      mockRecipientAccount(true)

      const result = await quote(1000000n)

      expect(result.transferFee).toBe(2500n)
    })

    it('should accept a number amount when quoting the transfer fee', async () => {
      mockMint([transferFeeConfig({ newer: { epoch: 0n, maximumFee: 1000000n, transferFeeBasisPoints: 50 } })])
      mockRecipientAccount(true)

      const result = await quote(1000000)

      expect(result.transferFee).toBe(5000n)
    })

    it('should resolve the token program of a quoted mint from the cache on a later balance read', async () => {
      mockMint([transferFeeConfig({ newer: { epoch: 0n, maximumFee: 1000000n, transferFeeBasisPoints: 50 } })])
      mockRecipientAccount(true)

      await quote()
      const mintRequestsAfterQuote = mockRpc.getMultipleAccounts.mock.calls.length

      await readOnlyAccount.getTokenBalance(TOKEN_2022_MINT)

      const [ata] = await findAssociatedTokenPda({
        mint: address(TOKEN_2022_MINT),
        owner: address(TEST_ADDRESS),
        tokenProgram: TOKEN_2022_PROGRAM_ADDRESS
      })

      expect(mockRpc.getMultipleAccounts).toHaveBeenCalledTimes(mintRequestsAfterQuote)
      expect(mockRpc.getAccountInfo).toHaveBeenLastCalledWith(ata, { commitment: 'confirmed', encoding: 'base64' })
    })

    it('should quote the transfer fee in force after the mint authority changes it between two quotes', async () => {
      mockMint([transferFeeConfig({ newer: { epoch: 0n, maximumFee: 1000000n, transferFeeBasisPoints: 50 } })])
      mockRecipientAccount(true)

      const before = await quote(1000000n)

      mockMint([transferFeeConfig({ newer: { epoch: 0n, maximumFee: 1000000n, transferFeeBasisPoints: 500 } })])

      const after = await quote(1000000n)

      expect(before.transferFee).toBe(5000n)
      expect(after.transferFee).toBe(50000n)
    })

    it('should reject a transfer once the mint authority sets a hook program after an earlier quote', async () => {
      const unsetHook = { __kind: 'TransferHook', authority: address(TEST_ADDRESS), programId: address('11111111111111111111111111111111') }
      mockMint([unsetHook])
      mockRecipientAccount(true)

      await quote()

      mockMint([{ ...unsetHook, programId: LEGACY_MEMO_PROGRAM_ADDRESS_V3 }])

      await expect(quote()).rejects.toThrow(new TransferHookNotSupportedError(
        `Token '${TOKEN_2022_MINT}' carries a transfer hook, which is not supported.`
      ))
    })
  })

  describe('getTransactionReceipt', () => {
    const MOCK_TX_SIGNATURE =
      '2k3dxVsXko3Vtb7z2W31GHCbZBzRXCAo5YYqbn7bxUCQM1RQb5Xq1XhWndFGhZGpZ5mGARUx5kavWqFVoBGujpWf'

    it('should return transaction receipt', async () => {
      const mockReceipt = {
        slot: 123456n,
        transaction: {
          message: {
            accountKeys: [],
            header: {
              numRequiredSignatures: 1,
              numReadonlySignedAccounts: 0,
              numReadonlyUnsignedAccounts: 1
            },
            instructions: [],
            recentBlockhash: 'HhqkdqemrKDK5Wd4oiCtzfpBWfdGS79YhLtzAck5Nz7T'
          },
          signatures: [MOCK_TX_SIGNATURE]
        },
        meta: {
          err: null,
          fee: 5000n,
          preBalances: [1000000000n],
          postBalances: [999995000n],
          innerInstructions: [],
          logMessages: [],
          preTokenBalances: [],
          postTokenBalances: [],
          rewards: []
        },
        blockTime: 1234567890n
      }

      mockRpc.getTransaction.mockReturnValue({
        send: jest.fn().mockResolvedValue(mockReceipt)
      })

      const receipt =
        await readOnlyAccount.getTransactionReceipt(MOCK_TX_SIGNATURE)

      expect(receipt).toEqual(mockReceipt)
      expect(receipt.slot).toBe(123456n)
      expect(receipt.meta.fee).toBe(5000n)
      expect(receipt.meta.err).toBeNull()

      expect(mockRpc.getTransaction).toHaveBeenCalledTimes(1)
      expect(mockRpc.getTransaction).toHaveBeenCalledWith(
        MOCK_TX_SIGNATURE,
        expect.objectContaining({
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0
        })
      )
    })

    it('should return null for non-existent transaction', async () => {
      mockRpc.getTransaction.mockReturnValue({
        send: jest.fn().mockResolvedValue(null)
      })

      const receipt =
        await readOnlyAccount.getTransactionReceipt(MOCK_TX_SIGNATURE)

      expect(receipt).toBeNull()
      expect(mockRpc.getTransaction).toHaveBeenCalledTimes(1)
    })

    it('should throw error when not connected to provider', async () => {
      const disconnectedAccount = new WalletAccountReadOnlySolana(
        TEST_ADDRESS,
        {}
      )

      await expect(
        disconnectedAccount.getTransactionReceipt(MOCK_TX_SIGNATURE)
      ).rejects.toThrow(
        'The wallet must be connected to a provider to fetch transaction receipts.'
      )
    })

    it('should throw error when getTransaction fails', async () => {
      mockRpc.getTransaction.mockReturnValue({
        send: jest
          .fn()
          .mockRejectedValue(
            new Error('RPC error: Failed to fetch transaction')
          )
      })

      await expect(
        readOnlyAccount.getTransactionReceipt(MOCK_TX_SIGNATURE)
      ).rejects.toThrow('RPC error: Failed to fetch transaction')

      expect(mockRpc.getTransaction).toHaveBeenCalledTimes(1)
    })
    it('should throw error for invalid signature format', async () => {
      const invalidSignature = 'invalid-signature'

      await expect(
        readOnlyAccount.getTransactionReceipt(invalidSignature)
      ).rejects.toThrow()
    })
  })

  describe('getTransaction', () => {
    const MOCK_TX_SIGNATURE =
      '2k3dxVsXko3Vtb7z2W31GHCbZBzRXCAo5YYqbn7bxUCQM1RQb5Xq1XhWndFGhZGpZ5mGARUx5kavWqFVoBGujpWf'

    function mockStatus (status) {
      mockRpc.getSignatureStatuses.mockReturnValue({
        send: jest.fn().mockResolvedValue({ value: [status] })
      })
    }

    function mockReceipt (receipt) {
      mockRpc.getTransaction.mockReturnValue({
        send: jest.fn().mockResolvedValue(receipt)
      })
    }

    it('should throw NoSuchElementError when the transaction is not known', async () => {
      mockStatus(null)

      await expect(readOnlyAccount.getTransaction(MOCK_TX_SIGNATURE)).rejects.toThrow(NoSuchElementError)
      expect(mockRpc.getTransaction).not.toHaveBeenCalled()
    })

    it('should report pending for a processed transaction', async () => {
      mockStatus({ slot: 100n, confirmations: 1n, err: null, confirmationStatus: 'processed' })

      const info = await readOnlyAccount.getTransaction(MOCK_TX_SIGNATURE)

      expect(info).toMatchObject({
        hash: MOCK_TX_SIGNATURE,
        finality: 'pending',
        success: undefined,
        block: 100,
        confirmations: 1,
        transaction: null
      })
      expect(info.fee).toBeUndefined()
      expect(mockRpc.getTransaction).not.toHaveBeenCalled()
    })

    it('should report confirmed with success and fee', async () => {
      mockStatus({ slot: 200n, confirmations: 10n, err: null, confirmationStatus: 'confirmed' })
      mockReceipt({ slot: 200n, meta: { err: null, fee: 5000n } })

      const info = await readOnlyAccount.getTransaction(MOCK_TX_SIGNATURE)

      expect(info).toMatchObject({
        finality: 'confirmed',
        success: true,
        block: 200,
        fee: 5000n,
        confirmations: 10
      })
      expect(info.transaction).not.toBeNull()
    })

    it('should report final when finalized (confirmations null)', async () => {
      mockStatus({ slot: 300n, confirmations: null, err: null, confirmationStatus: 'finalized' })
      mockReceipt({ slot: 300n, meta: { err: null, fee: 5000n } })

      const info = await readOnlyAccount.getTransaction(MOCK_TX_SIGNATURE)

      expect(info).toMatchObject({
        finality: 'final',
        success: true,
        confirmations: null
      })
    })

    it('should report success false for a reverted transaction', async () => {
      mockStatus({ slot: 400n, confirmations: null, err: { InstructionError: [0, 'Custom'] }, confirmationStatus: 'finalized' })
      mockReceipt({ slot: 400n, meta: { err: { InstructionError: [0, 'Custom'] }, fee: 5000n } })

      const info = await readOnlyAccount.getTransaction(MOCK_TX_SIGNATURE)

      expect(info.finality).toBe('final')
      expect(info.success).toBe(false)
    })

    it('should search transaction history when querying signature statuses', async () => {
      mockStatus({ slot: 200n, confirmations: 10n, err: null, confirmationStatus: 'confirmed' })
      mockReceipt({ slot: 200n, meta: { err: null, fee: 5000n } })

      await readOnlyAccount.getTransaction(MOCK_TX_SIGNATURE)

      expect(mockRpc.getSignatureStatuses).toHaveBeenCalledWith(
        [MOCK_TX_SIGNATURE],
        expect.objectContaining({ searchTransactionHistory: true })
      )
    })

    it('should throw error when not connected to provider', async () => {
      const disconnectedAccount = new WalletAccountReadOnlySolana(TEST_ADDRESS, {})

      await expect(
        disconnectedAccount.getTransaction(MOCK_TX_SIGNATURE)
      ).rejects.toThrow(
        'The wallet must be connected to a provider to fetch transactions.'
      )
    })

    it('should throw ValueError for invalid signature format', async () => {
      await expect(readOnlyAccount.getTransaction('invalid-signature')).rejects.toThrow(ValueError)
    })
  })

  describe('verify', () => {
    it('should verify signature for same message across multiple verifications', async () => {
      const account = new WalletAccountSolana(
        TEST_SEED_PHRASE,
        "0'/0'/0'",
        {
          provider: TEST_RPC_URL,
          commitment: 'processed'
        }
      )
      const message = 'Persistent message'
      const signature = await account.sign(message)

      const readOnlyAccount = new WalletAccountReadOnlySolana(
        await account.getAddress(),
        {}
      )
      const isValid1 = await readOnlyAccount.verify(message, signature)
      const isValid2 = await readOnlyAccount.verify(message, signature)
      const isValid3 = await readOnlyAccount.verify(message, signature)

      expect(isValid1).toBe(true)
      expect(isValid2).toBe(true)
      expect(isValid3).toBe(true)

      account.dispose()
    })

    it('should reject signature for different message', async () => {
      const account = new WalletAccountSolana(
        TEST_SEED_PHRASE,
        "0'/0'/0'",
        {
          provider: TEST_RPC_URL,
          commitment: 'processed'
        }
      )
      const message1 = 'Message 1'
      const message2 = 'Message 2'
      const signature1 = await account.sign(message1)

      const readOnlyAccount = new WalletAccountReadOnlySolana(
        await account.getAddress(),
        {}
      )
      expect(await readOnlyAccount.verify(message1, signature1)).toBe(true)
      expect(await readOnlyAccount.verify(message2, signature1)).toBe(false)

      account.dispose()
    })

    it('should reject invalid hex signature', async () => {
      const message = 'Test message'
      const invalidSignature = 'not-a-valid-hex-signature'

      const readOnlyAccount = new WalletAccountReadOnlySolana(
        TEST_ACCOUNT_ADDRESS,
        {}
      )
      expect(await readOnlyAccount.verify(message, invalidSignature)).toBe(
        false
      )
    })
  })
})
