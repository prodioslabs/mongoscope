import { describe, expect, it } from 'vitest'
import {
  formatBytes,
  formatBuildProgress,
  formatIndexFlags,
  formatIndexKey,
  formatOps,
  formatSince,
} from './format'

describe('formatBytes', () => {
  it('formats small and large sizes', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1536)).toBe('1.5 KiB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MiB')
  })

  it('uses an em dash for missing values', () => {
    expect(formatBytes(null)).toBe('—')
    expect(formatBytes(Number.NaN)).toBe('—')
  })
})

describe('formatOps', () => {
  it('formats counts with grouping', () => {
    expect(formatOps(12)).toBe('12')
    expect(formatOps(1200)).toBe('1,200')
  })

  it('uses an em dash for missing values', () => {
    expect(formatOps(null)).toBe('—')
  })
})

describe('formatSince', () => {
  it('formats relative ages', () => {
    const now = Date.parse('2024-06-01T12:00:00.000Z')
    expect(formatSince(new Date(now - 45_000), now)).toBe('45s ago')
    expect(formatSince(new Date(now - 10 * 60_000), now)).toBe('10m ago')
    expect(formatSince(new Date(now - 5 * 3600_000), now)).toBe('5h ago')
    expect(formatSince(new Date(now - 3 * 86400_000), now)).toBe('3d ago')
  })

  it('uses an em dash for missing values', () => {
    expect(formatSince(null)).toBe('—')
  })
})

describe('formatIndexKey', () => {
  it('compacts key documents', () => {
    expect(formatIndexKey({ a: 1, b: -1 })).toBe('a:1,b:-1')
    expect(formatIndexKey({ _id: 1 })).toBe('_id:1')
  })

  it('uses an em dash for invalid keys', () => {
    expect(formatIndexKey(null)).toBe('—')
    expect(formatIndexKey([])).toBe('—')
  })
})

describe('formatIndexFlags', () => {
  it('joins flags or shows em dash', () => {
    expect(formatIndexFlags(['unique', 'sparse'])).toBe('unique,sparse')
    expect(formatIndexFlags([])).toBe('—')
  })
})


describe('formatBuildProgress', () => {
  it('formats percent, building, and idle', () => {
    expect(formatBuildProgress({ building: false, buildPercent: null })).toBe('—')
    expect(formatBuildProgress({ building: true, buildPercent: 42 })).toBe('42%')
    expect(formatBuildProgress({ building: true, buildPercent: null })).toBe('building')
  })
})
