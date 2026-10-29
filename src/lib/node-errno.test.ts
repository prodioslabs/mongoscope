import { describe, expect, it } from 'vitest'
import {
  isFileNotFoundError,
  isFsPermissionDeniedError,
  isNodeErrnoException,
} from './node-errno'

function errno(code: string): NodeJS.ErrnoException {
  return Object.assign(new Error(code), { code })
}

describe('node-errno', () => {
  it('narrows objects with a code field', () => {
    expect(isNodeErrnoException(errno('ENOENT'))).toBe(true)
    expect(isNodeErrnoException(new Error('plain'))).toBe(false)
    expect(isNodeErrnoException(null)).toBe(false)
    expect(isNodeErrnoException('ENOENT')).toBe(false)
  })

  it('detects ENOENT', () => {
    expect(isFileNotFoundError(errno('ENOENT'))).toBe(true)
    expect(isFileNotFoundError(errno('EACCES'))).toBe(false)
  })

  it('detects EACCES and EPERM', () => {
    expect(isFsPermissionDeniedError(errno('EACCES'))).toBe(true)
    expect(isFsPermissionDeniedError(errno('EPERM'))).toBe(true)
    expect(isFsPermissionDeniedError(errno('ENOENT'))).toBe(false)
  })
})
