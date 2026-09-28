export function errorMessageText(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (error != null && typeof error === 'object' && 'message' in error) {
    const maybe = (error as { message?: unknown }).message
    if (typeof maybe === 'string') {
      return maybe
    }
  }
  return String(error)
}
