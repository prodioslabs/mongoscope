import { describe, expect, it } from 'vitest'
import {
  collectionTopBarSegments,
  collectionTopBarWidths,
  formatRunningMs,
  formatTopTimeLabel,
  partialBarString,
  runningMsSeverity,
  truncateLiveOpsCell,
} from './format'
import { isUnauthorizedError, panelErrorFromUnknown } from './permissions'

describe('partialBarString', () => {
  it('renders empty and full tracks', () => {
    expect(partialBarString(0, 20)).toBe('█'.repeat(20))
    expect(partialBarString(100, 20)).toBe('█'.repeat(20))
  })

  it('distinguishes close percentages that whole-block rounding collapses', () => {
    const bar81 = partialBarString(81, 20)
    const bar84 = partialBarString(84, 20)
    expect(bar81).not.toBe(bar84)
    expect(bar81).toBe(`${'█'.repeat(16)}▎${'█'.repeat(3)}`)
    expect(bar84).toBe(`${'█'.repeat(16)}▊${'█'.repeat(3)}`)
    expect(bar81.length).toBe(20)
    expect(bar84.length).toBe(20)
  })

  it('uses partial blocks at sub-character resolution', () => {
    expect(partialBarString(50, 10)).toBe(`${'█'.repeat(5)}${'█'.repeat(5)}`)
    expect(partialBarString(55, 10)).toBe(`${'█'.repeat(5)}▌${'█'.repeat(4)}`)
  })
})

describe('collectionTopBarSegments', () => {
  it('splits read and write with partial boundaries when row is the max', () => {
    const maxTotalMs = 810 + 190
    const bars = collectionTopBarSegments(810, 190, 20, maxTotalMs)
    expect(bars.read.length + bars.write.length + bars.empty.length).toBe(20)
    expect(bars.read.endsWith('▎')).toBe(true)
    const bars2 = collectionTopBarSegments(840, 160, 20, 840 + 160)
    expect(bars2.read.endsWith('▊')).toBe(true)
    expect(bars.read).not.toBe(bars2.read)
  })

  it('scales bar length to max total across rows (mongotop-style)', () => {
    const bars = collectionTopBarSegments(3, 0, 24, 500)
    expect(bars.read + bars.write + bars.empty).toHaveLength(24)
    expect(bars.read).toBe('▏')
    expect(bars.write).toBe('')
    expect(bars.empty).toBe('█'.repeat(23))
  })

  it('fills the track for the busiest row', () => {
    const bars = collectionTopBarSegments(500, 0, 24, 500)
    expect(bars.read).toBe('█'.repeat(24))
    expect(bars.write).toBe('')
    expect(bars.empty).toBe('')
  })
})

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
