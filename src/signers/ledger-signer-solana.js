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

import { DeviceActionStatus, DeviceManagementKitBuilder, DeviceStatus } from '@ledgerhq/device-management-kit'
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
import { getBase64EncodedWireTransaction, getTransactionDecoder, getTransactionEncoder } from '@solana/transactions'
import { SYSTEM_PROGRAM_ADDRESS } from '@solana-program/system'

import { assertFullHardenedPath } from './signer-solana.js'

const BIP_44_SOL_DERIVATION_PATH_PREFIX = "44'/501'"

/** @typedef {import("./signer-solana.js").ISignerSolana} ISignerSolana */

/** @typedef {import("@ledgerhq/device-management-kit").DeviceManagementKit} DeviceManagementKit */
/** @typedef {import("@ledgerhq/device-signer-kit-solana/internal/DefaultSignerSolana.js").DefaultSignerSolana} DefaultSignerSolana */
/**
 * @template TOutput
 * @typedef {import('@ledgerhq/device-management-kit').DeviceActionState<TOutput, unknown, unknown>} DeviceActionState
 */

/** @typedef {import("@solana/offchain-messages").OffchainMessage} OffchainMessage */

/**
 * @template T
 * @typedef {import('rxjs').Observable<T>} Observable
 */

/**
 * @typedef {Object} LedgerSignerSolOpts
 * @property {DeviceManagementKit} [dmk] Shared [DMK](https://developers.ledger.com/docs/device-interaction/integration/how_to/dmk).
 */

/**
 * @typedef {{}} LedgerSignerSolCfg
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
   * @param {LedgerSignerSolCfg} config - The signer configuration. Currently unused.
   * @param {LedgerSignerSolOpts} opts - Optional constructor dependencies.
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
    this._dmk = opts.dmk || new DeviceManagementKitBuilder().addTransport(webHidTransportFactory).build()
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
    if (!this._dmk) throw new Error('Cannot connect the disposed device.')

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
    const address = await this._consumeDeviceAction(observable)

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
    await this._ensureDeviceReady()

    return this._address
  }

  async sign (message) {
    await this._ensureDeviceReady()

    const { observable } = this._account.signMessage(this._path, message)
    const { signature: envelopedSignature } = await this._consumeDeviceAction(observable)

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
    await this._ensureDeviceReady()

    const tx = getTransactionDecoder().decode(unsignedTx)
    console.log('tx', tx)

    const { observable } = this._account.signTransaction(
      this._path,
      Uint8Array.from(tx.messageBytes)
    )
    const signature = await this._consumeDeviceAction(observable)
    console.log('signature', signature)

    const signedTransaction = getTransactionEncoder().encode({
      messageBytes: tx.messageBytes,
      signatures: {
        [address(this._address)]: signatureBytes(signature)
      }
    })
    console.log('signedTransaction', signedTransaction)
    console.log('getBase64EncodedWireTransaction(signedTransaction)', getBase64EncodedWireTransaction(signedTransaction))

    return Buffer.from(getBase64EncodedWireTransaction(signedTransaction), 'base64')
  }

  dispose () {
    this._disconnect()
    this._dmk = undefined
  }

  /**
   * Ensures the device is in a usable state before sending actions.
   * - If the device is locked or busy, fails fast with a friendly error.
   * - If the device is not connected, attempts to reconnect.
   *
   * @private
   * @throws {Error} If the device is locked, busy, or not ready before the timeout expires.
   */
  async _ensureDeviceReady () {
    if (!this._account) await this._connect()

    const state = await firstValueFrom(
      this._dmk.getDeviceSessionState({ sessionId: this._sessionId })
    )

    if (state.status === DeviceStatus.LOCKED) {
      throw new Error('Device is locked.')
    }

    if (state.status === DeviceStatus.BUSY) {
      throw new Error('Device is busy.')
    }

    if (state.status === DeviceStatus.NOT_CONNECTED) {
      await this._connect()
    }
  }

  /**
   * Consume a DeviceAction observable and resolve on Completed; reject early on Error/Stopped.
   *
   * @private
   * @template TOutput
   * @param {Observable<DeviceActionState<TOutput>>} observable
   * @returns {Promise<TOutput>}
   */
  async _consumeDeviceAction (observable) {
    return await firstValueFrom(
      observable.pipe(
        filter(
          (evt) =>
            evt.status === DeviceActionStatus.Completed ||
            evt.status === DeviceActionStatus.Error ||
            evt.status === DeviceActionStatus.Stopped
        ),
        map((evt) => {
          if (evt.status === DeviceActionStatus.Completed) return evt.output
          if (evt.status === DeviceActionStatus.Error) {
            throw evt.error || new Error('Unknown Ledger error.')
          }
          throw new Error('Action stopped.')
        })
      )
    )
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
