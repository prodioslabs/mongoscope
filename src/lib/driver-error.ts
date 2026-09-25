import { isRecord } from './is-record'

/**
 * Structural shape of MongoDB Node driver / command failures.
 * Prefer {@link asDriverErrorLike} over ad-hoc casts.
 */
type DriverErrorLike = {
  code?: string | number
  codeName?: string
  message?: string
}

export function asDriverErrorLike(error: unknown): DriverErrorLike | null {
  if (!isRecord(error)) {
    return null
  }

  const result: DriverErrorLike = {}
  if (typeof error.code === 'string' || typeof error.code === 'number') {
    result.code = error.code
  }
  if (typeof error.codeName === 'string') {
    result.codeName = error.codeName
  }
  if (typeof error.message === 'string') {
    result.message = error.message
  }
  return result
}
