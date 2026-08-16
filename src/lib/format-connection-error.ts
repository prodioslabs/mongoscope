import { SecretStoreError } from '../connections/secret-store'

/** User-facing message for connection save/load/delete failures. Never includes secrets. */
export function formatConnectionError(error: unknown): string {
  if (error instanceof SecretStoreError) {
    return error.message
  }
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}
