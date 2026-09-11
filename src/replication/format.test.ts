import { describe, expect, it } from 'vitest'
import {
  formatBytes,
  formatGrowthRate,
  formatLagSeconds,
  formatMemberLabel,
  formatPriorityVotes,
  formatWindowHours,
} from './format'

describe('formatLagSeconds', () => {
  it('formats lag under a minute as seconds', () => {
    expect(formatLagSeconds(0)).toBe('0s')
    expect(formatLagSeconds(3)).toBe('3s')
    expect(formatLagSeconds(59.4)).toBe('59s')
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
    expect(formatWindowHours(24)).toBe('24.0h')
    expect(formatWindowHours(1.25)).toBe('1.3h')
    expect(formatWindowHours(null)).toBe('—')
  })
})

describe('formatGrowthRate', () => {
  it('formats bytes/hour growth', () => {
    expect(formatGrowthRate(1_048_576)).toBe('1.0 MiB/h')
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

describe('formatPriorityVotes', () => {
  it('renders priority and votes or dashes', () => {
    expect(formatPriorityVotes(1, 1)).toBe('1 / 1')
    expect(formatPriorityVotes(0, 0)).toBe('0 / 0')
    expect(formatPriorityVotes(null, 1)).toBe('— / 1')
    expect(formatPriorityVotes(2, null)).toBe('2 / —')
  })
})
