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
import { getBase58Decoder } from '@solana/codecs'
import { isSolanaError, SOLANA_ERROR__TRANSACTION__ADDRESSES_CANNOT_SIGN_TRANSACTION } from '@solana/errors'
import { getTransferSolInstruction } from '@solana-program/system'
import { UnsupportedOperationError, ValueError } from '@tetherto/wdk-wallet'

import PrivateKeySignerSolana from '../../src/signers/private-key-signer-solana.js'
import SeedSignerSolana from '../../src/signers/seed-signer-solana.js'

const TEST_SEED_PHRASE = 'test walk nut penalty hip pave soap entry language right filter choice'

const PRIVATE_KEY = 'de705bcaa34a2ea50c0b7e6e584006f2458652fa9d6e20994ac146852490c76f'
const PUBLIC_KEY = '2b2c715c2cf24db57e95a44df34cb424de2460e86c4f6ebe7ba62b574830de19'
const ADDRESS = '3uXqWpwgqKVdiHAwF6Vmu4G4vdQzpR66xjPkz1G7zMKE'

const INVALID_PRIVATE_KEY_MESSAGE = 'The private key must be a 32-byte key (hex or bytes) or a 64-byte secret key (base58 or bytes).'

const SECRET_KEY = Buffer.concat([Buffer.from(PRIVATE_KEY, 'hex'), Buffer.from(PUBLIC_KEY, 'hex')])

function buildUnsignedTransaction (feePayer) {
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayer(address(feePayer), tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash({ blockhash: '11111111111111111111111111111111', lastValidBlockHeight: 0n }, tx),
    (tx) => appendTransactionMessageInstruction(getTransferSolInstruction({
      source: createNoopSigner(address(feePayer)),
      destination: address('CfGcujEkPVDx7yGyn1PUjxn2e353MXbLk8ixzwuJUktK'),
      amount: 1_000n
    }), tx)
  )

  return Uint8Array.from(getTransactionEncoder().encode(compileTransaction(message)))
}

describe('PrivateKeySignerSolana', () => {
  describe('constructor', () => {
    it('should accept a hex string', async () => {
      const signer = new PrivateKeySignerSolana(PRIVATE_KEY)

      expect(await signer.getAddress()).toBe(ADDRESS)
      expect(Buffer.from(signer.keyPair.publicKey).toString('hex')).toBe(PUBLIC_KEY)
    })

    it('should accept 32 bytes', async () => {
      const signer = new PrivateKeySignerSolana(Buffer.from(PRIVATE_KEY, 'hex'))

      expect(await signer.getAddress()).toBe(ADDRESS)
    })

    it('should accept a 64-byte secret key', async () => {
      const signer = new PrivateKeySignerSolana(Uint8Array.from(SECRET_KEY))

      expect(await signer.getAddress()).toBe(ADDRESS)
      expect(Buffer.from(signer.keyPair.privateKey).toString('hex')).toBe(PRIVATE_KEY)
    })

    it('should accept a base58 64-byte secret key', async () => {
      const signer = new PrivateKeySignerSolana(getBase58Decoder().decode(SECRET_KEY))

      expect(await signer.getAddress()).toBe(ADDRESS)
      expect(Buffer.from(signer.keyPair.privateKey).toString('hex')).toBe(PRIVATE_KEY)
    })

    it('should throw if a secret key\'s public half does not match its private half', () => {
      const secretKey = Uint8Array.from(SECRET_KEY)
      secretKey[63] ^= 1

      expect(() => new PrivateKeySignerSolana(secretKey))
        .toThrow(new ValueError('The secret key\'s public key does not match its private key.'))
    })

    it('should throw if the private key is too short', () => {
      expect(() => new PrivateKeySignerSolana('deadbeef'))
        .toThrow(new ValueError(INVALID_PRIVATE_KEY_MESSAGE))
    })

    it('should throw if a hex key has trailing characters', () => {
      expect(() => new PrivateKeySignerSolana(PRIVATE_KEY + 'zz'))
        .toThrow(new ValueError(INVALID_PRIVATE_KEY_MESSAGE))
    })

    it('should throw if a hex key has an extra digit', () => {
      expect(() => new PrivateKeySignerSolana(PRIVATE_KEY + 'a'))
        .toThrow(new ValueError(INVALID_PRIVATE_KEY_MESSAGE))
    })

    it('should throw if the bytes are neither 32 nor 64 long', () => {
      expect(() => new PrivateKeySignerSolana(new Uint8Array(33)))
        .toThrow(new ValueError(INVALID_PRIVATE_KEY_MESSAGE))
    })
  })

  describe('derivation', () => {
    it('should not be derivable', () => {
      const signer = new PrivateKeySignerSolana(PRIVATE_KEY)

      expect(signer.isDerivable).toBe(false)
      expect(signer.path).toBeNull()
    })

    it('should throw on derive', async () => {
      const signer = new PrivateKeySignerSolana(PRIVATE_KEY)

      await expect(signer.derive("0'/0'")).rejects.toThrow(UnsupportedOperationError)
    })
  })

  describe('signing', () => {
    it('should produce the Ed25519 signature of the message', async () => {
      const signer = new PrivateKeySignerSolana(PRIVATE_KEY)

      expect(await signer.sign('Hello, Solana!')).toBe(
        '5bbab8653d010e9fb4e4c09c98972d81752b246a7af411bbdb6d3d72e8fe4023d5a94551eadb64e4f1b767e18bba00ff48855e08bc61bb79601dfb77af754f0e'
      )
    })

    it('should sign messages like the seed signer holding the same key', async () => {
      const signer = new PrivateKeySignerSolana(PRIVATE_KEY)
      const seedSigner = new SeedSignerSolana(TEST_SEED_PHRASE, "m/44'/501'/0'/0'")

      expect(await signer.sign('Hello, Solana!')).toBe(await seedSigner.sign('Hello, Solana!'))
    })

    it('should sign transactions like the seed signer holding the same key', async () => {
      const signer = new PrivateKeySignerSolana(PRIVATE_KEY)
      const seedSigner = new SeedSignerSolana(TEST_SEED_PHRASE, "m/44'/501'/0'/0'")
      const unsignedTx = buildUnsignedTransaction(ADDRESS)

      const signed = getTransactionDecoder().decode(await signer.signTransaction(unsignedTx))
      const expected = getTransactionDecoder().decode(await seedSigner.signTransaction(unsignedTx))

      expect(Buffer.from(signed.signatures[ADDRESS]).toString('hex'))
        .toBe(Buffer.from(expected.signatures[ADDRESS]).toString('hex'))
    })

    it('should throw if the key is not one of the transaction signers', async () => {
      const signer = new PrivateKeySignerSolana(PRIVATE_KEY)
      const unsignedTx = buildUnsignedTransaction('CfGcujEkPVDx7yGyn1PUjxn2e353MXbLk8ixzwuJUktK')

      const error = await signer.signTransaction(unsignedTx).catch((error) => error)

      expect(isSolanaError(error, SOLANA_ERROR__TRANSACTION__ADDRESSES_CANNOT_SIGN_TRANSACTION)).toBe(true)
    })
  })

  describe('key ownership', () => {
    it('should keep signing after the caller wipes the supplied key', async () => {
      const suppliedKey = Buffer.from(PRIVATE_KEY, 'hex')
      const signer = new PrivateKeySignerSolana(suppliedKey)
      const expected = await new PrivateKeySignerSolana(PRIVATE_KEY).sign('Hello, Solana!')

      suppliedKey.fill(0)

      expect(await signer.sign('Hello, Solana!')).toBe(expected)
    })

    it('should not wipe the supplied key on dispose', () => {
      const suppliedKey = Buffer.from(PRIVATE_KEY, 'hex')
      const signer = new PrivateKeySignerSolana(suppliedKey)

      signer.dispose()

      expect(suppliedKey.toString('hex')).toBe(PRIVATE_KEY)
      expect(signer.keyPair.privateKey).toBeNull()
      expect(Buffer.from(signer.keyPair.publicKey).toString('hex')).toBe(PUBLIC_KEY)
    })
  })
})
