import { isUnauthorizedError } from './permissions'
import type { IndexesPanelError } from './types'

export function panelErrorFromUnknown(
  error: unknown,
  fallbackMessage = 'failed to load',
): IndexesPanelError {
  if (isUnauthorizedError(error)) {
    return {
      kind: 'permission',
      message: 'insufficient permissions',
    }
  }
  return {
    kind: 'unknown',
    message: fallbackMessage,
  }
}
