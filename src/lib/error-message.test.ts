import { describe, expect, it } from 'vitest'
import { errorMessageText } from './error-message'

describe('errorMessageText', () => {
  it('reads Error.message', () => {
    expect(errorMessageText(new Error('boom'))).toBe('boom')
  })

  it('reads message from plain objects', () => {
    expect(errorMessageText({ message: 'driver-ish' })).toBe('driver-ish')
  })

  it('stringifies non-Error values', () => {
    expect(errorMessageText('plain')).toBe('plain')
    expect(errorMessageText(42)).toBe('42')
  })
})
