/** Coerce unknown values to a string; non-strings become ''. */
export function stringOrEmpty(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }
  return ''
}
