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

/** An error for a token whose mint carries the Token-2022 non-transferable extension. */
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

/** An error for a token whose mint carries a Token-2022 transfer hook with a hook program set. */
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

/** An error for a token whose mint is configured for Token-2022 confidential transfers. */
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

/** An error for a transfer whose destination token account is, or would be created, frozen. */
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
