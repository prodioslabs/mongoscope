import { describe, expect, it } from 'vitest'
import {
  formatBytes,
  formatGrowthRate,
  formatHeartbeatEdge,
  formatLagSeconds,
  formatMemberLabel,
  formatMemberMeta,
  formatPingMs,
  formatPriorityVotes,
  formatShortHost,
  formatWindowHours,
  horizontalBarString,
  verticalBarChartLines,
} from './format'

describe('formatLagSeconds', () => {
  it('formats lag under a minute with one decimal when needed', () => {
    expect(formatLagSeconds(0)).toBe('0s')
    expect(formatLagSeconds(1.2)).toBe('1.2s')
    expect(formatLagSeconds(8.4)).toBe('8.4s')
    expect(formatLagSeconds(3)).toBe('3s')
  })

  it('formats longer lag as m/s or h/m', () => {
    expect(formatLagSeconds(90)).toBe('1m 30s')
    expect(formatLagSeconds(3_661)).toBe('1h 1m')
  })

  it('uses an em dash for unknown lag', () => {
    expect(formatLagSeconds(null)).toBe('—')
  })
})

describe('formatBytes', () => {
  it('formats bytes with binary units', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1_048_576)).toBe('1.0 MiB')
    expect(formatBytes(1_073_741_824)).toBe('1.0 GiB')
  })
})

describe('formatWindowHours', () => {
  it('formats fractional hours and unknown windows', () => {
    expect(formatWindowHours(24)).toBe('24.0 hrs')
    expect(formatWindowHours(1.25)).toBe('1.3 hrs')
    expect(formatWindowHours(null)).toBe('—')
  })
})

describe('formatGrowthRate', () => {
  it('formats bytes/hour growth', () => {
    expect(formatGrowthRate(1_048_576)).toBe('~1.0 MiB/hr')
    expect(formatGrowthRate(null)).toBe('—')
  })
})

describe('formatMemberLabel', () => {
  it('shortens host:port to hostname without port when possible', () => {
    expect(formatMemberLabel('mongo-a.example.net:27017')).toBe('mongo-a.example.net')
    expect(formatMemberLabel('127.0.0.1:27017')).toBe('127.0.0.1:27017')
    expect(formatMemberLabel('localhost:27017')).toBe('localhost')
  })
})

describe('formatPriorityVotes / formatMemberMeta / formatHeartbeatEdge', () => {
  it('renders priority and votes or dashes', () => {
    expect(formatPriorityVotes(1, 1)).toBe('1 / 1')
    expect(formatPriorityVotes(null, 1)).toBe('— / 1')
    expect(formatMemberMeta(2, 1)).toBe('priority 2 • votes 1')
    expect(formatMemberMeta(null, 0)).toBe('priority — • votes 0')
  })

  it('formats short heartbeat edge labels', () => {
    expect(formatHeartbeatEdge('rs0-a.prod.internal:27017', 'rs0-b.prod.internal:27017')).toBe(
      'rs0-a → rs0-b',
    )
    expect(formatPingMs(4)).toBe('4ms')
    expect(formatShortHost('rs0-c.prod.internal:27017')).toBe('rs0-c')
  })
})

describe('horizontalBarString / verticalBarChartLines', () => {
  it('builds a fixed-width horizontal fill bar', () => {
    expect(horizontalBarString(0, 10)).toBe(' '.repeat(10))
    expect(horizontalBarString(100, 10)).toBe('█'.repeat(10))
    expect(horizontalBarString(50, 10).length).toBe(10)
  })

  it('builds a multi-row vertical histogram', () => {
    const lines = verticalBarChartLines([1, 4, 2], 4)
    expect(lines).toHaveLength(4)
    expect(lines.every((line) => line.length === 3)).toBe(true)
    expect(lines[0]).toBe(' █ ') // top row — only the peak column
    expect(lines[3]).toBe('███') // bottom row — all columns
  })
})
