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

import { describe, it, expect } from '@jest/globals'
import * as bip39 from 'bip39'
import { address } from '@solana/addresses'
import { pipe } from '@solana/functional'
import { createNoopSigner } from '@solana/signers'
import {
  appendTransactionMessageInstruction,
  createTransactionMessage,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash
} from '@solana/transaction-messages'
import { compileTransaction, getTransactionDecoder, getTransactionEncoder } from '@solana/transactions'
import { isSolanaError, SOLANA_ERROR__TRANSACTION__ADDRESSES_CANNOT_SIGN_TRANSACTION } from '@solana/errors'
import { getTransferSolInstruction } from '@solana-program/system'
import { ValueError } from '@tetherto/wdk-wallet'

import SeedSignerSolana from '../../src/signers/seed-signer-solana.js'

const TEST_SEED_PHRASE = 'test walk nut penalty hip pave soap entry language right filter choice'

const ACCOUNT_0 = {
  path: "m/44'/501'/0'/0'",
  address: '3uXqWpwgqKVdiHAwF6Vmu4G4vdQzpR66xjPkz1G7zMKE',
  privateKey: 'de705bcaa34a2ea50c0b7e6e584006f2458652fa9d6e20994ac146852490c76f',
  publicKey: '2b2c715c2cf24db57e95a44df34cb424de2460e86c4f6ebe7ba62b574830de19',
  signature: '5bbab8653d010e9fb4e4c09c98972d81752b246a7af411bbdb6d3d72e8fe4023d5a94551eadb64e4f1b767e18bba00ff48855e08bc61bb79601dfb77af754f0e'
}

const ACCOUNT_1_ADDRESS = 'CfGcujEkPVDx7yGyn1PUjxn2e353MXbLk8ixzwuJUktK'

const HARDENED_PATH_MESSAGE = 'In Solana, every child path in a derivation path must be hardened.'

function buildUnsignedTransaction (feePayer, cosigner) {
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayer(address(feePayer), tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash({ blockhash: '11111111111111111111111111111111', lastValidBlockHeight: 0n }, tx),
    (tx) => appendTransactionMessageInstruction(getTransferSolInstruction({
      source: createNoopSigner(address(cosigner ?? feePayer)),
      destination: address('Grwp8oDHgAD8PVSS51pWGCY5QRM3hqiH8QcbPRAEUABq'),
      amount: 1_000n
    }), tx)
  )

  return Uint8Array.from(getTransactionEncoder().encode(compileTransaction(message)))
}

describe('SeedSignerSolana', () => {
  describe('constructor', () => {
    it('should default to the coin-type node', () => {
      const signer = new SeedSignerSolana(TEST_SEED_PHRASE)

      expect(signer.path).toBe("m/44'/501'")
      expect(signer.isDerivable).toBe(true)
    })

    it('should derive the key at an absolute path', async () => {
      const signer = new SeedSignerSolana(TEST_SEED_PHRASE, ACCOUNT_0.path)

      expect(signer.path).toBe(ACCOUNT_0.path)
      expect(await signer.getAddress()).toBe(ACCOUNT_0.address)
    })

    it('should accept raw seed bytes', async () => {
      const signer = new SeedSignerSolana(bip39.mnemonicToSeedSync(TEST_SEED_PHRASE), ACCOUNT_0.path)

      expect(await signer.getAddress()).toBe(ACCOUNT_0.address)
    })

    it('should accept the master path "m"', () => {
      const signer = new SeedSignerSolana(TEST_SEED_PHRASE, 'm')

      expect(signer.path).toBe('m')
    })

    it('should throw if the seed phrase is invalid', () => {
      expect(() => new SeedSignerSolana('invalid word that does not exist test test test test test test test'))
        .toThrow(new ValueError('The seed phrase is invalid.'))
    })

    it('should throw if the path is not absolute', () => {
      expect(() => new SeedSignerSolana(TEST_SEED_PHRASE, "44'/501'"))
        .toThrow('The derivation path must be absolute')
    })

    it('should throw if the path is not fully hardened', () => {
      expect(() => new SeedSignerSolana(TEST_SEED_PHRASE, "m/44'/501'/0'/0"))
        .toThrow(new ValueError(HARDENED_PATH_MESSAGE))
    })
  })

  describe('keyPair', () => {
    it('should expose the raw key pair', () => {
      const signer = new SeedSignerSolana(TEST_SEED_PHRASE, ACCOUNT_0.path)

      expect(Buffer.from(signer.keyPair.privateKey).toString('hex')).toBe(ACCOUNT_0.privateKey)
      expect(Buffer.from(signer.keyPair.publicKey).toString('hex')).toBe(ACCOUNT_0.publicKey)
    })
  })

  describe('derive', () => {
    it('should derive relative to the signer path', async () => {
      const child = await new SeedSignerSolana(TEST_SEED_PHRASE).derive("0'/0'")

      expect(child.path).toBe(ACCOUNT_0.path)
      expect(await child.getAddress()).toBe(ACCOUNT_0.address)
    })

    it('should derive the same key as the absolute path, one step at a time', async () => {
      const child = await (await new SeedSignerSolana(TEST_SEED_PHRASE).derive("1'")).derive("0'")

      expect(child.path).toBe("m/44'/501'/1'/0'")
      expect(await child.getAddress()).toBe(ACCOUNT_1_ADDRESS)
    })

    it('should leave the parent usable', async () => {
      const parent = new SeedSignerSolana(TEST_SEED_PHRASE, "m/44'/501'/0'")

      await parent.derive("0'")

      expect(await (await parent.derive("0'")).getAddress()).toBe(ACCOUNT_0.address)
    })

    it('should throw if the relative path is not fully hardened', async () => {
      await expect(new SeedSignerSolana(TEST_SEED_PHRASE).derive("0'/0"))
        .rejects.toThrow(new ValueError(HARDENED_PATH_MESSAGE))
    })
  })

  describe('sign', () => {
    it('should produce the Ed25519 signature of the message', async () => {
      const signer = new SeedSignerSolana(TEST_SEED_PHRASE, ACCOUNT_0.path)

      expect(await signer.sign('Hello, Solana!')).toBe(ACCOUNT_0.signature)
    })
  })

  describe('signTransaction', () => {
    it('should add the signer signature', async () => {
      const signer = new SeedSignerSolana(TEST_SEED_PHRASE, ACCOUNT_0.path)

      const signed = getTransactionDecoder().decode(await signer.signTransaction(buildUnsignedTransaction(ACCOUNT_0.address)))

      expect(signed.signatures[ACCOUNT_0.address]).toHaveLength(64)
    })

    it('should keep the signatures the transaction already carries', async () => {
      const feePayer = new SeedSignerSolana(TEST_SEED_PHRASE, ACCOUNT_0.path)
      const cosigner = new SeedSignerSolana(TEST_SEED_PHRASE, "m/44'/501'/1'/0'")
      const unsignedTx = buildUnsignedTransaction(ACCOUNT_0.address, ACCOUNT_1_ADDRESS)

      const partiallySigned = await cosigner.signTransaction(unsignedTx)
      const signed = getTransactionDecoder().decode(await feePayer.signTransaction(partiallySigned))
      const cosignerOnly = getTransactionDecoder().decode(partiallySigned)

      expect(Buffer.from(signed.signatures[ACCOUNT_1_ADDRESS]).toString('hex'))
        .toBe(Buffer.from(cosignerOnly.signatures[ACCOUNT_1_ADDRESS]).toString('hex'))
      expect(signed.signatures[ACCOUNT_0.address]).toHaveLength(64)
    })

    it('should throw if the key is not one of the transaction signers', async () => {
      const signer = new SeedSignerSolana(TEST_SEED_PHRASE, ACCOUNT_0.path)

      const error = await signer.signTransaction(buildUnsignedTransaction(ACCOUNT_1_ADDRESS)).catch((error) => error)

      expect(isSolanaError(error, SOLANA_ERROR__TRANSACTION__ADDRESSES_CANNOT_SIGN_TRANSACTION)).toBe(true)
    })
  })

  describe('dispose', () => {
    it('should erase the private key and keep the public key', () => {
      const signer = new SeedSignerSolana(TEST_SEED_PHRASE, ACCOUNT_0.path)

      signer.dispose()

      expect(signer.keyPair.privateKey).toBeNull()
      expect(Buffer.from(signer.keyPair.publicKey).toString('hex')).toBe(ACCOUNT_0.publicKey)
    })

    it('should not affect a child derived before', async () => {
      const parent = new SeedSignerSolana(TEST_SEED_PHRASE)
      const child = await parent.derive("0'/0'")

      parent.dispose()

      expect(await child.sign('Hello, Solana!')).toBe(ACCOUNT_0.signature)
    })

    it('should not affect the parent', async () => {
      const parent = new SeedSignerSolana(TEST_SEED_PHRASE, "m/44'/501'/0'")
      const child = await parent.derive("0'")

      child.dispose()

      expect(await (await parent.derive("0'")).sign('Hello, Solana!')).toBe(ACCOUNT_0.signature)
    })
  })
})
