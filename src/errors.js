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

import { WdkError } from '@tetherto/wdk-wallet'

/**
 * Thrown when a token cannot be transferred at all, because its mint carries the
 * Token-2022 non-transferable extension.
 */
export class NonTransferableTokenError extends WdkError {
  /**
   * Creates a new non-transferable token error.
   *
   * @param {string} message - The error's message.
   * @param {ErrorOptions} [options] - The error's options.
   */
  constructor (message, options) {
    super(message, options)

    this.name = 'NonTransferableTokenError'
  }
}

/**
 * Thrown when a token's mint carries a Token-2022 transfer hook, whose extra accounts
 * this wallet does not resolve.
 */
export class TransferHookNotSupportedError extends WdkError {
  /**
   * Creates a new transfer hook not supported error.
   *
   * @param {string} message - The error's message.
   * @param {ErrorOptions} [options] - The error's options.
   */
  constructor (message, options) {
    super(message, options)

    this.name = 'TransferHookNotSupportedError'
  }
}

/**
 * Thrown when a token's mint is configured for Token-2022 confidential transfers, which
 * this wallet does not perform.
 */
export class ConfidentialTransferNotSupportedError extends WdkError {
  /**
   * Creates a new confidential transfer not supported error.
   *
   * @param {string} message - The error's message.
   * @param {ErrorOptions} [options] - The error's options.
   */
  constructor (message, options) {
    super(message, options)

    this.name = 'ConfidentialTransferNotSupportedError'
  }
}

/**
 * Thrown when a transfer would land in a frozen token account, either because the
 * recipient's account is already frozen or because the mint freezes the accounts it
 * creates by default.
 */
export class FrozenTokenAccountError extends WdkError {
  /**
   * Creates a new frozen token account error.
   *
   * @param {string} message - The error's message.
   * @param {ErrorOptions} [options] - The error's options.
   */
  constructor (message, options) {
    super(message, options)

    this.name = 'FrozenTokenAccountError'
  }
}
