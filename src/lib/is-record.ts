/** Narrow unsanitized objects to a string-keyed record without casting. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
