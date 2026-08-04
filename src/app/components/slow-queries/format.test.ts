import { describe, expect, it } from 'vitest'
import {
  avgMsSeverity,
  examinedSeverity,
  formatCount,
  formatExaminedRet,
  formatWindowLabel,
  planSeverity,
  sparkline,
  truncateShape,
} from './format'

describe('formatCount', () => {
  it('adds thousands separators', () => {
    expect(formatCount(1204)).toBe('1,204')
    expect(formatCount(96400)).toBe('96,400')
  })
})

describe('formatExaminedRet', () => {
  it('formats both sides', () => {
    expect(formatExaminedRet(96400, 40)).toBe('96,400 / 40')
  })
})

describe('truncateShape', () => {
  it('leaves short shapes unchanged', () => {
    expect(truncateShape('{status:1}')).toBe('{status:1}')
  })

  it('truncates long shapes with an ellipsis', () => {
    const shape = `{${'a,'.repeat(40)}}`
    const truncated = truncateShape(shape, 20)
    expect(truncated).toHaveLength(20)
    expect(truncated.endsWith('…')).toBe(true)
  })
})

describe('formatWindowLabel', () => {
  it('formats minute and hour spans', () => {
    const start = Date.parse('2026-04-08T10:00:00.000Z')
    expect(formatWindowLabel(start, start + 15 * 60_000)).toBe('15m window')
    expect(formatWindowLabel(start, start + 2 * 3_600_000)).toBe('2h window')
  })

  it('returns full log for empty span', () => {
    expect(formatWindowLabel(0, 0)).toBe('full log')
  })
})

describe('sparkline', () => {
  it('maps values to block characters', () => {
    const trend = Uint16Array.from([0, 1, 2, 4])
    const s = sparkline(trend, 4)
    expect(s).toHaveLength(4)
    expect(s[0]).toBe('▁')
    expect(s.at(-1)).toBe('█')
  })

  it('downsamples to a fixed width by max-pooling', () => {
    const trend = new Uint16Array(24)
    trend[0] = 1
    trend[23] = 10
    const s = sparkline(trend, 12)
    expect(s).toHaveLength(12)
    expect(s.at(-1)).toBe('█')
    // First bucket is non-empty and lower than the peak
    expect(s[0]).not.toBe(' ')
    expect(s[0]!.charCodeAt(0)).toBeLessThan('█'.charCodeAt(0))
  })

  it('defaults to SPARKLINE_WIDTH', () => {
    const trend = new Uint16Array(24)
    trend[5] = 3
    expect(sparkline(trend)).toHaveLength(12)
  })
})

describe('severity helpers', () => {
  it('classifies avg ms', () => {
    expect(avgMsSeverity(50)).toBe('muted')
    expect(avgMsSeverity(100)).toBe('warning')
    expect(avgMsSeverity(500)).toBe('error')
  })

  it('classifies examined ratio', () => {
    expect(examinedSeverity(3100, 2910)).toBe('success')
    expect(examinedSeverity(8200, 20)).toBe('warning')
    expect(examinedSeverity(96400, 40)).toBe('error')
  })

  it('classifies plan', () => {
    expect(planSeverity('COLLSCAN')).toBe('error')
    expect(planSeverity('IXSCAN+SORT')).toBe('warning')
    expect(planSeverity('IXSCAN')).toBe('success')
    expect(planSeverity('n/a')).toBe('muted')
  })
})
