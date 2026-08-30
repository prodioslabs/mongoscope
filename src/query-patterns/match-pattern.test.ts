import { describe, expect, it } from 'vitest'
import { findBestMatchingPattern } from './match-pattern'
import type { QueryPattern } from './types'

function pattern(overrides: Partial<QueryPattern> & Pick<QueryPattern, 'id'>): QueryPattern {
  return {
    namespace: 'app.users',
    op: 'query',
    shape: '{}',
    count: 1,
    avgMs: 100,
    avgDocsExamined: 10,
    avgDocsReturned: 1,
    plan: 'COLLSCAN',
    trend: new Uint16Array(24),
    sampleRow: 0,
    totalDurationMs: 100,
    ...overrides,
  }
}

describe('findBestMatchingPattern', () => {
  const patterns = [
    pattern({ id: 1, namespace: 'app.users', op: 'query', plan: 'COLLSCAN', count: 5 }),
    pattern({ id: 2, namespace: 'app.users', op: 'query', plan: 'IXSCAN', count: 10 }),
    pattern({ id: 3, namespace: 'app.orders', op: 'update', plan: 'n/a', count: 3 }),
  ]

  it('matches namespace + op + plan and picks highest count', () => {
    const extra = [
      ...patterns,
      pattern({ id: 4, namespace: 'app.users', op: 'query', plan: 'COLLSCAN', count: 20 }),
    ]
    const match = findBestMatchingPattern(extra, {
      namespace: 'app.users',
      op: 'query',
      plan: 'COLLSCAN',
    })
    expect(match?.id).toBe(4)
  })

  it('falls back to namespace + op when plan differs', () => {
    const match = findBestMatchingPattern(patterns, {
      namespace: 'app.users',
      op: 'query',
      plan: 'n/a',
    })
    expect(match?.id).toBe(2)
  })

  it('returns null when no namespace+op match', () => {
    const match = findBestMatchingPattern(patterns, {
      namespace: 'app.users',
      op: 'insert',
      plan: 'n/a',
    })
    expect(match).toBeNull()
  })
})
