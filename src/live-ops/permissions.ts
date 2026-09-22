import { asDriverErrorLike } from '../lib/driver-error'
import { isUnauthorizedError } from '../lib/mongo-unauthorized-error'
import type { PanelError } from '../lib/panel-error'

export { isUnauthorizedError }

function isTopUnavailableOnMongos(error: unknown): boolean {
  const record = asDriverErrorLike(error)
  if (record == null) {
    return false
  }
  const message = typeof record.message === 'string' ? record.message.toLowerCase() : ''
  return (
    message.includes('mongos') ||
    message.includes("no such command: 'top'") ||
    message.includes('top command')
  )
}

export function panelErrorFromUnknown(error: unknown): PanelError {
  if (isUnauthorizedError(error)) {
    return {
      kind: 'permission',
      message: 'insufficient permissions',
    }
  }
  if (isTopUnavailableOnMongos(error)) {
    return {
      kind: 'unavailable',
      message: 'top unavailable on mongos',
    }
  }
  return {
    kind: 'unknown',
    message: 'failed to load',
  }
}
