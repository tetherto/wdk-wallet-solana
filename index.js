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

/** @typedef {import('@tetherto/wdk-wallet').FeeRates} FeeRates */

/** @typedef {import('@tetherto/wdk-wallet').KeyPair} KeyPair */
/** @typedef {import('@tetherto/wdk-wallet').TransactionResult} TransactionResult */
/** @typedef {import('@tetherto/wdk-wallet').TransferOptions} TransferOptions */
/** @typedef {import('@tetherto/wdk-wallet').TransferResult} TransferResult */
/** @typedef {import('@tetherto/wdk-wallet').Finality} Finality */
/** @typedef {import('@tetherto/wdk-wallet').TransactionReceipt} TransactionReceipt */
/** @typedef {import('@tetherto/wdk-wallet').WaitForTransactionTarget} WaitForTransactionTarget */
/** @typedef {import('@tetherto/wdk-wallet').WaitForTransactionOptions} WaitForTransactionOptions */

/** @typedef {import('./src/wallet-account-read-only-solana.js').SimpleSolanaTransaction} SimpleSolanaTransaction */
/** @typedef {import('./src/wallet-account-read-only-solana.js').SolanaTransactionReceipt} SolanaTransactionReceipt */
/** @typedef {import('./src/wallet-account-read-only-solana.js').SolanaTransactionDetails} SolanaTransactionDetails */
/** @typedef {import('./src/wallet-account-read-only-solana.js').SolanaTransferOptions} SolanaTransferOptions */
/** @typedef {import('./src/wallet-account-read-only-solana.js').SolanaTransferQuoteDetails} SolanaTransferQuoteDetails */
/** @typedef {import('./src/wallet-account-read-only-solana.js').MintAccount} MintAccount */
/** @typedef {import('./src/wallet-account-read-only-solana.js').TokenProgramAddress} TokenProgramAddress */

/** @typedef {import('./src/wallet-account-solana.js').SolanaTransaction} SolanaTransaction */
/** @typedef {import('./src/wallet-account-solana.js').SolanaWalletConfig} SolanaWalletConfig */

export { default } from './src/wallet-manager-solana.js'

export { default as WalletAccountReadOnlySolana } from './src/wallet-account-read-only-solana.js'

export { default as WalletAccountSolana } from './src/wallet-account-solana.js'

export {
  ConfidentialTransferNotSupportedError,
  FrozenTokenAccountError,
  NonTransferableTokenError,
  TransferHookNotSupportedError
} from './src/errors.js'

export {
  AssertionError,
  MaximumFeeExceededError,
  NoSuchElementError,
  ProviderRequiredError,
  TimeoutError,
  ValueError,
  WdkError
} from '@tetherto/wdk-wallet'
