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

import { ValueError } from '@tetherto/wdk-wallet'

/**
 * The signing domain prefix shared by every version 1 off-chain message.
 *
 * @see {@link https://docs.anza.xyz/proposals/off-chain-message-signing}
 *
 * @type {Uint8Array}
 */
export const OFFCHAIN_MESSAGE_SIGNING_DOMAIN = new Uint8Array([
  0xff, 0x73, 0x6f, 0x6c, 0x61, 0x6e, 0x61, 0x20, 0x6f, 0x66, 0x66, 0x63, 0x68, 0x61, 0x69, 0x6e
])

/**
 * The version of the off-chain message format.
 *
 * @type {number}
 */
export const OFFCHAIN_MESSAGE_VERSION = 1

/**
 * Creates a version 1 off-chain message.
 *
 * An off-chain message is the byte string that gets signed, so that a message
 * signature can never be a valid transaction signature.
 *
 * @param {string} message - The message content. It must be a non-empty string.
 * @param {Uint8Array} signerPublicKey - The Ed25519 public key of the required signer (32 bytes).
 * @returns {Uint8Array} The off-chain message bytes.
 * @throws {ValueError} If the message is not a non-empty string.
 */
export function createOffchainMessage (message, signerPublicKey) {
  if (typeof message !== 'string') {
    throw new ValueError('The message must be a string.')
  }

  if (message.length === 0) {
    throw new ValueError('The message must not be empty.')
  }

  const content = Buffer.from(message, 'utf8')

  const offchainMessage = Buffer.alloc(OFFCHAIN_MESSAGE_SIGNING_DOMAIN.length + 2 + signerPublicKey.length + content.length)

  let offset = 0

  offchainMessage.set(OFFCHAIN_MESSAGE_SIGNING_DOMAIN, offset)
  offset += OFFCHAIN_MESSAGE_SIGNING_DOMAIN.length

  offchainMessage[offset++] = OFFCHAIN_MESSAGE_VERSION

  // The number of required signers. This account is the only signer.
  offchainMessage[offset++] = 1

  offchainMessage.set(signerPublicKey, offset)
  offset += signerPublicKey.length

  offchainMessage.set(content, offset)

  return offchainMessage
}
