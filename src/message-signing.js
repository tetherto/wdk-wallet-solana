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

/**
 * The Solana off-chain message signing domain.
 *
 * These are the 16 bytes `0xff || "solana offchain"`, taken verbatim from the Solana
 * off-chain message specification as implemented by the Anza Solana SDK. The
 * specification applies them as a hidden prefix to the content that is signed, so that
 * an off-chain message signature and an on-chain transaction signature can never be
 * produced from the same preimage.
 *
 * The same domain is used by the ecosystem implementations of off-chain message
 * signing, for example Sign In With Solana and the Phantom, Backpack and OneKey
 * wallets.
 *
 * A transaction message always starts with its message header, whose first byte is the
 * number of required signers, so it never begins with the 0xff byte that opens this
 * domain.
 *
 * @see https://github.com/anza-xyz/kit/blob/main/packages/offchain-messages/src/codecs/signing-domain.ts
 * @type {Uint8Array}
 */
export const OFFCHAIN_MESSAGE_SIGNING_DOMAIN = new Uint8Array([
  0xff, 0x73, 0x6f, 0x6c, 0x61, 0x6e, 0x61, 0x20, 0x6f, 0x66, 0x66, 0x63, 0x68, 0x61, 0x69, 0x6e
])

/**
 * Builds the exact byte string that is signed by `sign()` and checked by `verify()` for
 * a message: the off-chain message signing domain followed by the UTF-8 message bytes.
 *
 * Signing and verifying must both go through this function so that the two operations
 * always cover the same preimage.
 *
 * The message must be a string. Raw bytes are rejected, because signing arbitrary bytes
 * with the wallet key is exactly what would let a caller obtain a signature that is also
 * a valid transaction signature.
 *
 * @param {string} message - The message to sign or verify.
 * @returns {Uint8Array} The domain-prefixed UTF-8 message bytes.
 * @throws {TypeError} If the message is not a string.
 */
export function getMessageSigningPayload (message) {
  if (typeof message !== 'string') {
    throw new TypeError('The message must be a string.')
  }

  const messageBytes = Buffer.from(message, 'utf8')

  return Buffer.concat([Buffer.from(OFFCHAIN_MESSAGE_SIGNING_DOMAIN), messageBytes])
}
