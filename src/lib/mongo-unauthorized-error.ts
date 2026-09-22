import { asDriverErrorLike } from './driver-error'

/**
 * Detect unauthorized / privilege failures from MongoDB driver errors.
 * Never includes connection strings — callers should already avoid logging raw errors.
 */
export function isUnauthorizedError(error: unknown): boolean {
  const record = asDriverErrorLike(error)
  if (record == null) {
    return false
  }
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
