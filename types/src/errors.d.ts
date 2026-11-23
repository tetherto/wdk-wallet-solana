/** An error for a token whose mint carries the Token-2022 non-transferable extension. */
export class NonTransferableTokenError extends WdkError {
}
/** An error for a token whose mint carries a Token-2022 transfer hook with a hook program set. */
export class TransferHookNotSupportedError extends WdkError {
}
/** An error for a token whose mint is configured for Token-2022 confidential transfers. */
export class ConfidentialTransferNotSupportedError extends WdkError {
}
/** An error for a transfer whose destination token account is, or would be created, frozen. */
export class FrozenTokenAccountError extends WdkError {
}
import { WdkError } from '@tetherto/wdk-wallet';
