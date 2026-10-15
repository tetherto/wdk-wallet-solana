/**
 * Thrown when a token cannot be transferred at all, because its mint carries the
 * Token-2022 non-transferable extension.
 */
export class NonTransferableTokenError extends WdkError {
}
/**
 * Thrown when a token's mint carries a Token-2022 transfer hook, whose extra accounts
 * this wallet does not resolve.
 */
export class TransferHookNotSupportedError extends WdkError {
}
/**
 * Thrown when a token's mint is configured for Token-2022 confidential transfers, which
 * this wallet does not perform.
 */
export class ConfidentialTransferNotSupportedError extends WdkError {
}
/**
 * Thrown when a transfer would land in a frozen token account, either because the
 * recipient's account is already frozen or because the mint freezes the accounts it
 * creates by default.
 */
export class FrozenTokenAccountError extends WdkError {
}
import { WdkError } from '@tetherto/wdk-wallet';
