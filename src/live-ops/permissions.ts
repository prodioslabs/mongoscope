/**
 * Detect unauthorized / privilege failures from driver errors.
 * Never includes connection strings — callers should already avoid logging raw errors.
 */
export function isUnauthorizedError(error: unknown): boolean {
  if (error == null || typeof error !== 'object') {
    return false
  }
  const record = error as { code?: unknown; codeName?: unknown; message?: unknown }
  if (record.code === 13 || record.codeName === 'Unauthorized') {
    return true
  }
  const message = typeof record.message === 'string' ? record.message.toLowerCase() : ''
  return (
    message.includes('not authorized') ||
    message.includes('unauthorized') ||
    message.includes('requires authentication') ||
    message.includes('command top requires authentication')
  )
}

export function isTopUnavailableOnMongos(error: unknown): boolean {
  if (error == null || typeof error !== 'object') {
    return false
  }
  const message =
    typeof (error as { message?: unknown }).message === 'string'
      ? ((error as { message: string }).message).toLowerCase()
      : ''
  return (
    message.includes('mongos') ||
    message.includes("no such command: 'top'") ||
    message.includes('top command')
  )
}

export function panelErrorFromUnknown(error: unknown): {
  kind: 'permission' | 'unavailable' | 'unknown'
  message: string
} {
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
