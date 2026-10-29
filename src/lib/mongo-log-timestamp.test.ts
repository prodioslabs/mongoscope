import { describe, expect, it } from 'vitest'
import { parseMongoLogTimestampMs } from './mongo-log-timestamp'

describe('parseMongoLogTimestampMs', () => {
  it('parses ISO strings', () => {
    expect(parseMongoLogTimestampMs('2024-01-01T00:00:00.000Z')).toBe(
      Date.parse('2024-01-01T00:00:00.000Z'),
    )
  })

  it('parses extended JSON $date', () => {
    expect(parseMongoLogTimestampMs({ $date: '2024-01-01T00:00:00.000Z' })).toBe(
      Date.parse('2024-01-01T00:00:00.000Z'),
    )
    expect(parseMongoLogTimestampMs({ $date: 1_704_067_200_000 })).toBe(1_704_067_200_000)
  })

  it('returns null for missing or invalid values', () => {
    expect(parseMongoLogTimestampMs(null)).toBeNull()
    expect(parseMongoLogTimestampMs(undefined)).toBeNull()
    expect(parseMongoLogTimestampMs('not-a-date')).toBeNull()
    expect(parseMongoLogTimestampMs({ $date: {} })).toBeNull()
    expect(parseMongoLogTimestampMs(42)).toBeNull()
  })
})
