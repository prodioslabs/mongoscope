/** Narrow unsanitized objects to a string-keyed record without casting. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** Same as {@link isRecord}, returning null instead of a type predicate. */
export function asRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null
}
