import { errorMessageText } from '../lib/error-message'

/** User-facing message for connection save/load/delete failures. Never includes secrets. */
export function formatConnectionError(error: unknown): string {
  return errorMessageText(error)
}
