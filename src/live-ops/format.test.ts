import { describe, expect, it } from 'vitest'
import {
  collectionTopBarWidths,
  formatRunningMs,
  formatTopTimeLabel,
  runningMsSeverity,
  truncateLiveOpsCell,
} from './format'
import { isUnauthorizedError, panelErrorFromUnknown } from './permissions'

describe('runningMsSeverity', () => {
  it('matches slow-query style thresholds', () => {
    expect(runningMsSeverity(50)).toBe('normal')
    expect(runningMsSeverity(100)).toBe('warning')
    expect(runningMsSeverity(500)).toBe('error')
  })
})

describe('format helpers', () => {
  it('formats running ms and truncates cells', () => {
    expect(formatRunningMs(8412)).toBe('8,412')
    expect(truncateLiveOpsCell('abcdefghij', 6)).toBe('abcde…')
  })

  it('splits bar widths and formats time labels', () => {
    expect(collectionTopBarWidths(75, 25, 10)).toEqual({
      readWidth: 8,
      writeWidth: 2,
      emptyWidth: 0,
    })
    expect(formatTopTimeLabel(100, 50)).toBe('150ms')
    expect(formatTopTimeLabel(800, 400)).toBe('1.2s')
  })
})

describe('permissions', () => {
  it('detects unauthorized errors', () => {
    expect(isUnauthorizedError({ code: 13, codeName: 'Unauthorized' })).toBe(true)
    expect(isUnauthorizedError(new Error('not authorized on admin'))).toBe(true)
    expect(panelErrorFromUnknown({ code: 13 }).kind).toBe('permission')
  })
})
