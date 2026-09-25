/** Coerce an unknown thrown value to a message string. */
export function errorMessageText(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}
