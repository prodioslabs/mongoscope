import { describe, expect, it } from 'vitest'
import type { PatternExplain, QueryPattern } from '../../../../query-patterns'
import { buildQueryDetailCopyText, buildSuggestedIndexCopyText } from './build-copy-text'

function makePattern(overrides: Partial<QueryPattern> = {}): QueryPattern {
  return {
    id: 1,
    namespace: 'app.users',
    op: 'find',
    shape: 'find status',
    count: 3,
    avgMs: 120,
    avgDocsExamined: 100,
    avgDocsReturned: 1,
    plan: 'COLLSCAN',
    trend: new Uint16Array([1, 2, 3]),
    sampleRow: 0,
    totalDurationMs: 360,
    ...overrides,
  }
}

function makeExplain(overrides: Partial<PatternExplain> = {}): PatternExplain {
  return {
    namespace: 'app.users',
    op: 'find',
    plan: 'COLLSCAN',
    planSummary: null,
    filter: '{"status":1}',
    docsExamined: 100,
    nReturned: 1,
    totalMillis: 120,
    stageDetail: 'COLLSCAN',
    suggestedIndex: {
      command: 'db.users.createIndex({ status: 1 })',
      reason: 'equality on status',
      estimatedExamined: 1,
      namespace: 'app.users',
      database: 'app',
      collection: 'users',
      equalityFields: ['status'],
      keyLabel: 'status:1',
    },
    timestampMs: Date.parse('2024-01-01T00:00:00.000Z'),
    ctx: 'conn1',
    appName: 'api',
    remote: '127.0.0.1:1234',
    protocol: 'op_msg',
    keysExamined: 0,
    numYields: 1,
    reslen: 64,
    cpuNanos: null,
    workingMillis: null,
    waitForWriteConcernDurationMillis: null,
    commandDisplay: '{\n  "find": "users"\n}',
    rawDisplay: '{\n  "msg": "Slow query"\n}',
    ...overrides,
  }
}

describe('buildQueryDetailCopyText', () => {
  it('returns null while explain or pattern is missing', () => {
    expect(buildQueryDetailCopyText(null, makePattern(), false)).toBeNull()
    expect(buildQueryDetailCopyText(makeExplain(), null, false)).toBeNull()
  })

  it('copies the raw sample when raw view is active', () => {
    const explain = makeExplain()
    expect(buildQueryDetailCopyText(explain, makePattern(), true)).toBe(explain.rawDisplay)
  })

  it('returns null for empty raw display', () => {
    expect(buildQueryDetailCopyText(makeExplain({ rawDisplay: '   ' }), makePattern(), true)).toBeNull()
    expect(
      buildQueryDetailCopyText(makeExplain({ rawDisplay: 'undefined' }), makePattern(), true),
    ).toBeNull()
  })

  it('builds curated plain text with sections and no ANSI', () => {
    const text = buildQueryDetailCopyText(makeExplain(), makePattern(), false)
    expect(text).not.toBeNull()
    expect(text!).toContain('Diagnosis')
    expect(text!).toContain('Namespace: app.users')
    expect(text!).toContain('Filter / pipeline')
    expect(text!).toContain('"status": 1')
    expect(text!).toContain('Suggested index')
    expect(text!).toContain('db.users.createIndex({ status: 1 })')
    expect(text!).toContain('Pattern')
    expect(text!).toContain('Count: 3')
    expect(text!).toContain('Context')
    expect(text!).toContain('Timestamp: 2024-01-01T00:00:00.000Z')
    expect(text!).toContain('Work')
    expect(text!).toContain('Yields: 1')
    expect(text!).toContain('Command')
    expect(text!).toContain('"find": "users"')
    expect(text!).not.toMatch(/\x1b\[/)
  })

  it('omits suggested index section when none exists', () => {
    const text = buildQueryDetailCopyText(makeExplain({ suggestedIndex: null }), makePattern(), false)
    expect(text).not.toContain('Suggested index')
  })

  it('does not truncate long filter lines', () => {
    const long = `{"a":"${'x'.repeat(500)}"}`
    const text = buildQueryDetailCopyText(makeExplain({ filter: long }), makePattern(), false)
    expect(text).toContain('x'.repeat(500))
  })
})

describe('buildSuggestedIndexCopyText', () => {
  it('returns the suggested index command', () => {
    expect(buildSuggestedIndexCopyText(makeExplain())).toBe('db.users.createIndex({ status: 1 })')
  })

  it('returns null when no suggestion exists', () => {
    expect(buildSuggestedIndexCopyText(makeExplain({ suggestedIndex: null }))).toBeNull()
    expect(buildSuggestedIndexCopyText(null)).toBeNull()
  })

  it('returns null for empty or literal undefined commands', () => {
    const empty = makeExplain()
    empty.suggestedIndex = { ...empty.suggestedIndex!, command: '  ' }
    expect(buildSuggestedIndexCopyText(empty)).toBeNull()

    const undef = makeExplain()
    undef.suggestedIndex = { ...undef.suggestedIndex!, command: 'undefined' }
    expect(buildSuggestedIndexCopyText(undef)).toBeNull()
  })
})
