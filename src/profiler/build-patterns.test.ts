import { describe, expect, it } from 'vitest'
import { buildPatternsFromSamples } from './build-patterns'
import { toProfileSample } from './profile-doc'

function sample(overrides: {
  ns?: string
  millis?: number
  filter?: Record<string, unknown>
  planSummary?: string
  ts?: Date
  op?: string
}) {
  const ts = overrides.ts ?? new Date('2024-01-01T00:00:00.000Z')
  const doc = {
    ns: overrides.ns ?? 'app.orders',
    op: overrides.op ?? 'query',
    millis: overrides.millis ?? 100,
    planSummary: overrides.planSummary ?? 'COLLSCAN',
    docsExamined: 50,
    nreturned: 2,
    ts,
    command: {
      find: 'orders',
      filter: overrides.filter ?? { status: 'open' },
    },
  }
  const profileSample = toProfileSample(doc)
  if (profileSample == null) {
    throw new Error('expected valid sample')
  }
  return profileSample
}

describe('buildPatternsFromSamples', () => {
  it('groups by namespace/op/shape and picks slowest sampleIndex', () => {
    const a = sample({ millis: 50, ts: new Date('2024-01-01T00:00:00.000Z') })
    const b = sample({ millis: 200, ts: new Date('2024-01-01T00:01:00.000Z') })
    const c = sample({
      millis: 80,
      filter: { other: 1 },
      ts: new Date('2024-01-01T00:02:00.000Z'),
    })

    const result = buildPatternsFromSamples([a, b, c])
    expect(result.slowQueryCount).toBe(3)
    expect(result.patterns.length).toBe(2)

    const openPattern = result.patterns.find((p) => p.shape.includes('status'))
    expect(openPattern).toBeDefined()
    expect(openPattern!.count).toBe(2)
    expect(openPattern!.avgMs).toBe(125)
    expect(result.samples[openPattern!.sampleRow]).toBe(b.doc)
  })

  it('returns empty store when no usable samples', () => {
    const result = buildPatternsFromSamples([])
    expect(result.patterns).toEqual([])
    expect(result.slowQueryCount).toBe(0)
  })

  it('fills trend buckets across the window', () => {
    const early = sample({ millis: 10, ts: new Date('2024-01-01T00:00:00.000Z') })
    const late = sample({ millis: 10, ts: new Date('2024-01-01T00:10:00.000Z') })
    const result = buildPatternsFromSamples([early, late])
    expect(result.patterns[0]!.trend.some((n) => n > 0)).toBe(true)
    expect(result.windowStartMs).toBe(early.timestampMs)
    expect(result.windowEndMs).toBe(late.timestampMs)
  })
})
