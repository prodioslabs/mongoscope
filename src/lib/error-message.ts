import { isRecord } from './is-record'

export function errorMessageText(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (isRecord(error) && typeof error.message === 'string') {
    return error.message
  }
  return String(error)
}
