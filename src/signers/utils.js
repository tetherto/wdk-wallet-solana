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

import { getTransactionDecoder, getTransactionEncoder } from '@solana/transactions'
import { SolanaError, SOLANA_ERROR__TRANSACTION__ADDRESSES_CANNOT_SIGN_TRANSACTION } from '@solana/errors'

import * as curve from '@noble/ed25519'
import { sha512 } from '@noble/hashes/sha2.js'

// To enable @noble's synchronous methods
curve.hashes.sha512 = sha512

/**
 * Signs a message with a raw Ed25519 private key.
 *
 * The key is used in place: no `CryptoKey`, PKCS#8 or JWK copy of it is ever created.
 *
 * @param {Uint8Array} privateKey - The raw Ed25519 private key (32 bytes).
 * @param {string} message - The message to sign.
 * @returns {string} The message's signature, as a hex string.
 */
export function signMessage (privateKey, message) {
  return Buffer.from(curve.sign(Buffer.from(message, 'utf8'), privateKey)).toString('hex')
}

/**
 * Adds a raw Ed25519 private key's signature to a wire-encoded transaction, keeping the
 * signatures it already carries.
 *
 * @param {Uint8Array} privateKey - The raw Ed25519 private key (32 bytes).
 * @param {string} address - The key's address.
 * @param {Uint8Array} unsignedTx - The wire-encoded transaction.
 * @returns {Uint8Array} The wire-encoded transaction with the key's signature added.
 * @throws {SolanaError} With code `SOLANA_ERROR__TRANSACTION__ADDRESSES_CANNOT_SIGN_TRANSACTION` if the address is not one of the transaction's signers.
 */
export function signTransactionBytes (privateKey, address, unsignedTx) {
  const transaction = getTransactionDecoder().decode(unsignedTx)

  if (transaction.signatures[address] === undefined) {
    throw new SolanaError(SOLANA_ERROR__TRANSACTION__ADDRESSES_CANNOT_SIGN_TRANSACTION, {
      expectedAddresses: Object.keys(transaction.signatures),
      unexpectedAddresses: [address]
    })
  }

  const signedTransaction = {
    ...transaction,
    signatures: {
      ...transaction.signatures,
      [address]: curve.sign(transaction.messageBytes, privateKey)
    }
  }

  return Uint8Array.from(getTransactionEncoder().encode(signedTransaction))
}
