import { describe, expect, it } from 'vitest'
import {
  enableErrorFromUnknown,
  isProfilerUnavailableOnMongos,
  readErrorFromUnknown,
  statusErrorFromUnknown,
} from './permissions'

describe('profiler permissions', () => {
  it('maps status unauthorized distinctly', () => {
    const err = statusErrorFromUnknown({ code: 13, codeName: 'Unauthorized' })
    expect(err.kind).toBe('permission')
    expect(err.message).toContain('enableProfiler')
  })

  it('maps read unauthorized distinctly', () => {
    const err = readErrorFromUnknown({ code: 13, message: 'not authorized' })
    expect(err.kind).toBe('permission')
    expect(err.message).toContain('system.profile')
  })

  it('maps enable unauthorized distinctly', () => {
    const err = enableErrorFromUnknown({ codeName: 'Unauthorized' })
    expect(err.kind).toBe('permission')
    expect(err.message).toContain('cannot enable profiler')
  })

  it('detects mongos unavailability', () => {
    expect(
      isProfilerUnavailableOnMongos({
        message: "profile command can't be run on mongos",
      }),
    ).toBe(true)
    expect(enableErrorFromUnknown({ message: 'mongos' }).kind).toBe('unavailable')
  })
})
