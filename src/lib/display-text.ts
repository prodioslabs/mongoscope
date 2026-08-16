/** Coerce external values to a string safe for OpenTUI `<text content={…}>`. */
export function displayText(value: unknown, fallback = ''): string {
  if (value == null) {
    return fallback
  }
  if (typeof value === 'string') {
    return value
  }
  return String(value)
}
