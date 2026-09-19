import { describe, expect, it } from 'vitest'
import { appendTailChunk } from './append-chunk'
import { extractLogLineAttrFields } from './attr-fields'
import { LogLineRingBuffer } from './ring-buffer'

const encoder = new TextEncoder()

function structuredLine(overrides?: {
  c?: string
  msg?: string
  ns?: string
  durationMillis?: number
  planSummary?: string
}): string {
  const c = overrides?.c ?? 'COMMAND'
  const msg = overrides?.msg ?? 'Slow query'
  const ns = overrides?.ns ?? 'app.users'
  const durationMillis = overrides?.durationMillis ?? 120
  const planSummary = overrides?.planSummary ?? 'IXSCAN'
  return `{"t":{"$date":"2024-01-01T00:00:00.000Z"},"s":"I",  "c":"${c}",  "id":51803,   "ctx":"conn1","msg":"${msg}","attr":{"ns":"${ns}","durationMillis":${durationMillis},"planSummary":"${planSummary}"}}\n`
}

describe('extractLogLineAttrFields', () => {
  it('extracts optional fields without requiring ns', () => {
    expect(extractLogLineAttrFields({ durationMillis: 42, planSummary: 'COLLSCAN' })).toEqual({
      namespace: null,
      durationMillis: 42,
      planSummary: 'COLLSCAN',
    })
  })

  it('returns nulls for non-objects', () => {
    expect(extractLogLineAttrFields(null)).toEqual({
      namespace: null,
      durationMillis: null,
      planSummary: null,
    })
  })
})

describe('appendTailChunk carry', () => {
  it('reassembles a line split across two reads without flushCarry', () => {
    const full = structuredLine({ msg: 'Split line', ns: 'db.col', durationMillis: 999 })
    const bytes = encoder.encode(full)
    const splitAt = Math.floor(bytes.length / 2)

    const ring = new LogLineRingBuffer(10)
    const first = appendTailChunk(ring, bytes.subarray(0, splitAt), 0, null, 0)
    expect(first.linesAdded).toBe(0)
    expect(first.carry).not.toBeNull()
    expect(ring.size).toBe(0)

    const second = appendTailChunk(
      ring,
      bytes.subarray(splitAt),
      splitAt,
      first.carry,
      first.carryFileOffset,
    )
    expect(second.linesAdded).toBe(1)
    expect(second.carry).toBeNull()
    expect(ring.size).toBe(1)
    const entry = ring.toArray()[0]!
    expect(entry.msg).toBe('Split line')
    expect(entry.namespace).toBe('db.col')
    expect(entry.durationMillis).toBe(999)
    expect(entry.component).toBe('COMMAND')
    expect(entry.kind).toBe('json')
  })

  it('keeps a trailing incomplete line in carry across a poll with no newline', () => {
    const ring = new LogLineRingBuffer(10)
    const partial = encoder.encode('{"t":{"$date":"2024-01-01T00:00:00.000Z"')
    const result = appendTailChunk(ring, partial, 0, null, 0)
    expect(result.linesAdded).toBe(0)
    expect(result.carry?.length).toBe(partial.length)
    expect(ring.size).toBe(0)
  })

  it('parses multiple complete lines in one chunk', () => {
    const ring = new LogLineRingBuffer(10)
    const chunk = encoder.encode(structuredLine({ msg: 'a' }) + structuredLine({ msg: 'b' }))
    const result = appendTailChunk(ring, chunk, 0, null, 0)
    expect(result.linesAdded).toBe(2)
    expect(ring.toArray().map((entry) => entry.msg)).toEqual(['a', 'b'])
  })
})
