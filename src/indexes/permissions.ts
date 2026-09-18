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
    message.includes('requires authentication')
  )
}
