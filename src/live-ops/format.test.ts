import { describe, expect, it } from 'vitest'
import { formatTopTimeLabel } from './collection-top'
import {
  collectionTopBarSegments,
  formatRunningMs,
  runningMsSeverity,
  truncateLiveOpsCell,
} from './format'
import { isUnauthorizedError, panelErrorFromUnknown } from './permissions'

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
    expect(bars.empty).toBe(' '.repeat(23))
  })

  it('fills the track for the busiest row', () => {
    const bars = collectionTopBarSegments(500, 0, 24, 500)
    expect(bars.read).toBe('█'.repeat(24))
    expect(bars.write).toBe('')
    expect(bars.empty).toBe('')
  })

  it('gives small rows a visible partial block on the same scale', () => {
    const maxTotalMs = 13_864.3
    const bars = collectionTopBarSegments(296, 0, 24, maxTotalMs)
    expect(bars.read.length + bars.write.length + bars.empty.length).toBe(24)
    expect((bars.read + bars.write).trim()).toBe('▌')
  })

  it('distinguishes close fill levels via partial blocks on a shared scale', () => {
    const trackWidth = 24
    const sharedMax = 10_000
    const bar2960 = collectionTopBarSegments(2960, 0, trackWidth, sharedMax)
    const bar3000 = collectionTopBarSegments(3000, 0, trackWidth, sharedMax)
    expect(bar2960.read + bar2960.write + bar2960.empty).toHaveLength(trackWidth)
    expect(bar3000.read + bar3000.write + bar3000.empty).toHaveLength(trackWidth)
    expect(bar2960.read).not.toBe(bar3000.read)
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

  it('formats time labels', () => {
    expect(formatTopTimeLabel(150)).toBe('150ms')
    expect(formatTopTimeLabel(1200)).toBe('1.2s')
  })
})

describe('permissions', () => {
  it('detects unauthorized errors', () => {
    expect(isUnauthorizedError({ code: 13, codeName: 'Unauthorized' })).toBe(true)
    expect(isUnauthorizedError(new Error('not authorized on admin'))).toBe(true)
    expect(panelErrorFromUnknown({ code: 13 }).kind).toBe('permission')
  })
})
