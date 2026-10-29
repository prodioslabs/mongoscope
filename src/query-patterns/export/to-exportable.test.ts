import { describe, expect, it } from 'vitest'
import type { PatternExplain, QueryPattern } from '../types'
import { toExportablePattern } from './to-exportable'

function makePattern(overrides: Partial<QueryPattern> = {}): QueryPattern {
  return {
    id: 0,
    namespace: 'app.users',
    op: 'find',
    shape: '{status:1}',
    count: 3,
    avgMs: 120,
    avgDocsExamined: 40,
    avgDocsReturned: 2,
    plan: 'IXSCAN',
    trend: Uint16Array.from([0, 0, 0, 3]),
    sampleRow: 0,
    totalDurationMs: 360,
    ...overrides,
  }
}

function makeExplain(overrides: Partial<PatternExplain> = {}): PatternExplain {
  return {
    namespace: 'app.users',
    op: 'find',
    plan: 'IXSCAN',
    planSummary: 'IXSCAN { status: 1 }',
    filter: '{\n  "status": "pending"\n}',
    docsExamined: 40,
    nReturned: 2,
    totalMillis: 180,
    stageDetail: 'IXSCAN',
    suggestedIndex: null,
    timestampMs: Date.parse('2026-10-08T10:00:00.000Z'),
    ctx: 'conn1',
    appName: 'api',
    remote: '127.0.0.1:1',
    protocol: 'op_msg',
    keysExamined: 40,
    numYields: 0,
    reslen: 100,
    cpuNanos: null,
    workingMillis: null,
    waitForWriteConcernDurationMillis: null,
    commandDisplay: '{\n  "find": "users"\n}',
    rawDisplay: '{}',
    ...overrides,
  }
}

describe('toExportablePattern', () => {
  it('omits trend, id, and sampleRow and embeds query detail', () => {
    const exported = toExportablePattern(makePattern({ id: 7, sampleRow: 12 }), makeExplain())
    expect(exported).not.toHaveProperty('trend')
    expect(exported).not.toHaveProperty('id')
    expect(exported).not.toHaveProperty('sampleRow')
    expect(exported.detail).not.toBeNull()
    expect(exported.detail!.filter).toContain('pending')
    expect(exported.detail!.command).toContain('find')
    expect(exported.detail!.timestamp).toBe('2026-10-08T10:00:00.000Z')
  })

  it('allows null detail when explain is unavailable', () => {
    expect(toExportablePattern(makePattern(), null).detail).toBeNull()
  })
})
