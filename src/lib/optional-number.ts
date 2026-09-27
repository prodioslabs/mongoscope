import { isRecord } from './is-record'

/**
 * Coerce MongoDB/BSON-ish numeric values (number, bigint, Long.toNumber()) to a
 * finite number, or null when the value is missing / non-numeric.
 */
export function optionalNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'bigint') {
    return Number(value)
  }
  if (isRecord(value) && typeof value.toNumber === 'function') {
    const maybe = value.toNumber()
    if (typeof maybe === 'number' && Number.isFinite(maybe)) {
      return maybe
    }
  }
  return null
}
