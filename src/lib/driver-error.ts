/**
 * Structural shape of MongoDB Node driver / command failures.
 * Prefer {@link asDriverErrorLike} over ad-hoc casts.
 */
export type DriverErrorLike = {
  code?: string | number
  codeName?: string
  message?: string
}

export function asDriverErrorLike(error: unknown): DriverErrorLike | null {
  if (error == null || typeof error !== 'object') {
    return null
  }
  return error as DriverErrorLike
}
