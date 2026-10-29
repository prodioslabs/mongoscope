import { describe, expect, it } from 'vitest'
import { mapWriteError } from './map-write-error'

function errno(code: string): NodeJS.ErrnoException {
  return Object.assign(new Error(code), { code })
}

describe('mapWriteError', () => {
  it('maps known errno codes to short messages', () => {
    expect(mapWriteError(errno('EACCES'))).toBe('permission denied')
    expect(mapWriteError(errno('EPERM'))).toBe('permission denied')
    expect(mapWriteError(errno('ENOENT'))).toBe('directory missing')
    expect(mapWriteError(errno('ENOSPC'))).toBe('disk full')
    expect(mapWriteError(errno('EISDIR'))).toBe('path is a directory')
  })

  it('falls back without exposing raw text', () => {
    expect(mapWriteError(new Error('EIO: something cryptic'))).toBe('could not write file')
    expect(mapWriteError('boom')).toBe('could not write file')
  })
})
