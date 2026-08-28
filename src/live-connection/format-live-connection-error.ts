import { LiveConnectionError } from './errors'
import { redactConnectionSecrets } from './redact'

/** User-facing message for live connect failures. Never includes secrets or raw Error objects. */
export function formatLiveConnectionError(error: unknown): string {
  if (error instanceof LiveConnectionError) {
    return error.message
  }
  if (error instanceof Error) {
    const redacted = redactConnectionSecrets(error.message).trim()
    if (redacted.length > 0) {
      return redacted
    }
    return 'Connection failed.'
  }
  if (error == null) {
    return 'Connection failed.'
  }
  return redactConnectionSecrets(String(error))
}
