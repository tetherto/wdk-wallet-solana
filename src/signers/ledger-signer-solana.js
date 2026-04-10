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

import { DeviceActionStatus, DeviceManagementKitBuilder } from '@ledgerhq/device-management-kit'
import { webHidTransportFactory } from '@ledgerhq/device-transport-kit-web-hid'
import { SignerSolanaBuilder } from '@ledgerhq/device-signer-kit-solana'
import { filter, firstValueFrom, map } from 'rxjs'
import { getBase58Encoder } from '@solana/codecs'
import {
  getOffchainMessageEncoder,
  getOffchainMessageEnvelopeDecoder,
  offchainMessageApplicationDomain,
  offchainMessageContentRestrictedAsciiOf1232BytesMax
} from '@solana/offchain-messages'
import { signatureBytes, verifySignature } from '@solana/keys'
import { address, getPublicKeyFromAddress } from '@solana/addresses'
import { getCompiledTransactionMessageEncoder } from '@solana/transaction-messages'
import { getTransactionDecoder, getTransactionEncoder } from '@solana/transactions'
import { SYSTEM_PROGRAM_ADDRESS } from '@solana-program/system'

import { assertFullHardenedPath } from './signer-solana.js'

const BIP_44_SOL_DERIVATION_PATH_PREFIX = "m/44'/501'"

/**
 * @typedef {import("./signer-solana.js").ISignerSolana} ISignerSolana
 */

/**
 * @typedef {import("@ledgerhq/device-management-kit").DeviceManagementKit} DeviceManagementKit
 */

/**
 * @typedef {import("@ledgerhq/device-signer-kit-solana/internal/DefaultSignerSolana.js").DefaultSignerSolana} DefaultSignerSolana
 */

/**
 * @typedef {import("@solana/offchain-messages").OffchainMessage} OffchainMessage
 */

/**
 * @typedef {Object} LedgerSignerSolOpts
 * @property {DeviceManagementKit} [dmk] Shared [DMK](https://developers.ledger.com/docs/device-interaction/integration/how_to/dmk).
 */

/**
 * @typedef {Object} LedgerSignerSolCfg
 */

/**
 *
 * @param {string} addr - The signer address
 * @param {string} message - The message
 * @returns {Uint8Array} The signing content
 */
export const constructOffchainMessageV0Content = (addr, message) => {
  /**
   * @type {OffchainMessage} Offchain message
   */
  const offchainMessage = {
    version: 0,
    requiredSignatories: [{ address: address(addr) }],
    applicationDomain: offchainMessageApplicationDomain(SYSTEM_PROGRAM_ADDRESS),
    content: offchainMessageContentRestrictedAsciiOf1232BytesMax(message)
  }

  const signingContent = getOffchainMessageEncoder().encode(offchainMessage)

  return Uint8Array.from(signingContent)
}

/**
 * @implements {ISignerSolana}
 */
export default class LedgerSignerSolana {
  /**
   * @constructor
   * @param {string} path The BIP-44 derivation path (e.g. "0'/0'"). Note that, All child paths must be hardened in Solana.
   * @param {LedgerSignerSolCfg} config
   * @param {LedgerSignerSolOpts} opts
   */
  constructor (path, config = {}, opts = {}) {
    if (!path) {
      throw new Error('Path is required.')
    }

    assertFullHardenedPath(path)

    this._config = config

    /**
     * The ledger signer.
     *
     * @private
     * @type {DefaultSignerSolana | undefined}
     */
    this._account = undefined

    /** @private */
    this._address = undefined

    /** @private */
    this._sessionId = ''

    /** @private */
    this._path = `${BIP_44_SOL_DERIVATION_PATH_PREFIX}/${path}`

    /**
     * @private
     * @type {DeviceManagementKit}
     */
    this._dmk =
      opts.dmk || new DeviceManagementKitBuilder().addTransport(webHidTransportFactory).build()
  }

  get index () {
    if (!this._path) return undefined
    return +this._path.replace(/'/g, '').split('/').at(3)
  }

  get path () {
    return this._path
  }

  get config () {
    return this._config
  }

  /**
   * Discover and connect the device
   *
   * @private
   */
  async _connect () {
    // Discover & Connect the device
    const device = await firstValueFrom(this._dmk.startDiscovering({}))
    this._sessionId = await this._dmk.connect({
      device,
      sessionRefresherOptions: { isRefresherDisabled: true }
    })

    // Create a hardware signer
    this._account = new SignerSolanaBuilder({
      dmk: this._dmk,
      sessionId: this._sessionId
    }).build()

    // Get the pubkey
    const { observable } = this._account.getAddress(this._path)
    const address = await firstValueFrom(
      observable.pipe(
        filter((evt) => evt.status === DeviceActionStatus.Completed),
        map((evt) => evt.output)
      )
    )

    // Active
    this._address = address
  }

  /**
   * Derive child signer
   * @param {string} relPath The BIP-44 derivation path (e.g. "0'/0'"). Note that, All child paths must be hardened in Solana.
   * @param {LedgerSignerSolCfg} cfg
   * @returns
   */
  derive (relPath, cfg = {}) {
    /**
     * @type {LedgerSignerSolCfg}
     */
    const mergedCfg = {
      ...this._config,
      ...Object.fromEntries(Object.entries(cfg).filter(([, v]) => v !== undefined))
    }

    /**
     * @type {LedgerSignerSolOpts}
     */
    const mergedOpts = {
      ...this.opts,
      dmk: this._dmk
    }

    return new LedgerSignerSolana(`${this._path}/${relPath}`, mergedCfg, mergedOpts)
  }

  async getAddress () {
    if (!this._account) await this._connect()
    return this._address
  }

  async sign (message) {
    if (!this._account) await this._connect()

    const { observable } = this._account.signMessage(this._path, message)
    const { signature: envelopedSignature } = await firstValueFrom(
      observable.pipe(
        filter((evt) => evt.status === DeviceActionStatus.Completed),
        map((evt) => evt.output)
      )
    )

    const { signatures } = getOffchainMessageEnvelopeDecoder().decode(
      getBase58Encoder().encode(envelopedSignature)
    )
    const [signature] = Object.values(signatures)

    return Buffer.from(signature).toString('hex')
  }

  async verify (message, signature) {
    if (!this._address) return false

    const pubkey = await getPublicKeyFromAddress(address(this._address))

    const messageBytes = constructOffchainMessageV0Content(this._address, message)
    const signatureBytes = Buffer.from(signature, 'hex')

    const isValid = await verifySignature(pubkey, signatureBytes, messageBytes)

    return isValid
  }

  async signTransaction (unsignedTx) {
    if (!this._account) await this._connect()

    const tx = getTransactionDecoder().decode(unsignedTx)

    /**
     * @type {TransactionMessageBytes} Cast the type from ReadonlyUint8Array<ArrayBuffer> to TransactionMessageBytes
     */
    const compiledTransactionMessage = getCompiledTransactionMessageEncoder().encode(tx)

    const { observable } = this._account.signTransaction(
      this._path,
      Uint8Array.from(compiledTransactionMessage)
    )
    const signature = await firstValueFrom(
      observable.pipe(
        filter((evt) => evt.status === DeviceActionStatus.Completed),
        map((evt) => evt.output)
      )
    )

    const readonlySignedTransaction = getTransactionEncoder().encode({
      messageBytes: compiledTransactionMessage,
      signatures: {
        [address(this._address)]: signatureBytes(signature)
      }
    })

    return Uint8Array.from(readonlySignedTransaction)
  }

  dispose () {
    this._disconnect()
    this._dmk = undefined
  }

  /** @private */
  async _disconnect () {
    try {
      if (this._account && this._dmk && this._sessionId) {
        await this._dmk.disconnect({ sessionId: this._sessionId })
      }
    } catch (_) {
      // ignore best-effort disconnect
    } finally {
      this._account = undefined
      this._sessionId = ''
    }
  }
}
