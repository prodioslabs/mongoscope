import { describe, expect, it } from 'vitest'
import { computeCollectionTopScale, formatTopTimeLabel } from './collection-top'
import {
  collectionTopBarSegments,
  collectionTopBarString,
  collectionTopBarWidths,
  collectionTopRowScale,
  formatRunningMs,
  maxCollectionTopTotalMs,
  partialBarString,
  runningMsSeverity,
  truncateLiveOpsCell,
} from './format'
import { isUnauthorizedError, panelErrorFromUnknown } from './permissions'

describe('partialBarString', () => {
  it('renders empty and full tracks', () => {
    expect(partialBarString(0, 20)).toBe(' '.repeat(20))
    expect(partialBarString(100, 20)).toBe('█'.repeat(20))
  })

  it('distinguishes close percentages that whole-block rounding collapses', () => {
    const bar81 = partialBarString(81, 20)
    const bar84 = partialBarString(84, 20)
    expect(bar81).not.toBe(bar84)
    expect(bar81).toBe(`${'█'.repeat(16)}▎${' '.repeat(3)}`)
    expect(bar84).toBe(`${'█'.repeat(16)}▊${' '.repeat(3)}`)
    expect(bar81.length).toBe(20)
    expect(bar84.length).toBe(20)
  })

  it('uses partial blocks at sub-character resolution', () => {
    expect(partialBarString(50, 10)).toBe(`${'█'.repeat(5)}${' '.repeat(5)}`)
    expect(partialBarString(55, 10)).toBe(`${'█'.repeat(5)}▌${' '.repeat(4)}`)
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
    expect(bars.empty).toBe(' '.repeat(23))
  })

  it('fills the track for the busiest row', () => {
    const bars = collectionTopBarSegments(500, 0, 24, 500)
    expect(bars.read).toBe('█'.repeat(24))
    expect(bars.write).toBe('')
    expect(bars.empty).toBe('')
  })
})

describe('collectionTopRowScale (normalized screenshot dataset)', () => {
  const screenshotRows = [
    { namespace: 'ucc-production.Form', readMs: 13_864.3, writeMs: 0, totalMs: 13_864.3 },
    { namespace: 'ucc-production.User', readMs: 296, writeMs: 0, totalMs: 296 },
    { namespace: 'ucc-production.Service', readMs: 29, writeMs: 0, totalMs: 29 },
    { namespace: 'local.oplog.rs', readMs: 15, writeMs: 0, totalMs: 15 },
    { namespace: 'ucc-production.Session', readMs: 14, writeMs: 0, totalMs: 14 },
    { namespace: 'config.system.sessions', readMs: 6, writeMs: 0, totalMs: 6 },
  ]
  const trackWidth = 24
  const maxTotalMs = maxCollectionTopTotalMs(screenshotRows)

  it('uses Form as max and computes expected percents', () => {
    expect(maxTotalMs).toBe(13_864.3)
    const form = collectionTopRowScale(13_864.3, 0, maxTotalMs, trackWidth)
    expect(form.fillPercent).toBe(100)
    expect(form.readPercent).toBe(100)
    expect(collectionTopBarString(13_864.3, 0, trackWidth, maxTotalMs)).toBe('█'.repeat(24))
  })

  it('gives small rows a visible partial block on the same scale', () => {
    const user = collectionTopRowScale(296, 0, maxTotalMs, trackWidth)
    expect(user.fillPercent).toBeCloseTo((296 / 13_864.3) * 100, 5)
    expect(user.readPercent).toBeCloseTo((296 / 13_864.3) * 100, 5)
    const userBar = collectionTopBarString(296, 0, trackWidth, maxTotalMs)
    expect(userBar.length).toBe(24)
    expect(userBar.trim()).toBe('▌')
  })
})

describe('collectionTopBarSegments integration with scale output', () => {
  const trackWidth = 24
  const rows = [
    { namespace: 'ucc-production.Form', readMs: 13_864.3, writeMs: 0, totalMs: 13_864.3 },
    { namespace: 'ucc-production.User', readMs: 296, writeMs: 0, totalMs: 296 },
  ]

  it('renders max row fully filled with bar string length equal to trackWidth', () => {
    const scale = computeCollectionTopScale(rows)
    const maxRow = scale.rows[0]
    expect(maxRow?.fillPercent).toBe(100)
    const bar = collectionTopBarString(
      maxRow!.readMs,
      maxRow!.writeMs,
      trackWidth,
      scale.maxTotalMs,
    )
    expect(bar.length).toBe(trackWidth)
    expect(bar).toBe('█'.repeat(trackWidth))
  })

  it('distinguishes close fill levels via partial blocks on a shared scale', () => {
    const sharedMax = 10_000
    const bar2960 = collectionTopBarString(2960, 0, trackWidth, sharedMax)
    const bar3000 = collectionTopBarString(3000, 0, trackWidth, sharedMax)
    expect(bar2960.length).toBe(trackWidth)
    expect(bar3000.length).toBe(trackWidth)
    expect(bar2960).not.toBe(bar3000)
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
