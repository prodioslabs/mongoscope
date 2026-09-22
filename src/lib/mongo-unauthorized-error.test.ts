import { describe, expect, it } from 'vitest'
import { isUnauthorizedError } from './mongo-unauthorized-error'

describe('isUnauthorizedError', () => {
  it('detects code 13 and Unauthorized codeName', () => {
    expect(isUnauthorizedError({ code: 13, codeName: 'Unauthorized' })).toBe(true)
    expect(isUnauthorizedError({ codeName: 'Unauthorized' })).toBe(true)
  })

  it('detects common message phrases', () => {
    expect(isUnauthorizedError(new Error('not authorized on admin'))).toBe(true)
    expect(isUnauthorizedError({ message: 'command top requires authentication' })).toBe(true)
    expect(isUnauthorizedError({ message: 'requires authentication' })).toBe(true)
  })

  it('rejects unrelated errors', () => {
    expect(isUnauthorizedError(null)).toBe(false)
    expect(isUnauthorizedError(new Error('network timeout'))).toBe(false)
    expect(isUnauthorizedError({ code: 50 })).toBe(false)
  })
})
