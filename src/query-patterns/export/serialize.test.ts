import { describe, expect, it } from 'vitest'
import { serializeSlowQueriesCsv } from './serialize-csv'
import { serializeSlowQueriesJson } from './serialize-json'
import { serializeSlowQueriesMarkdown } from './serialize-markdown'
import type { ExportablePattern, ExportableQueryDetail, SlowQueriesExportDocument } from './types'

function meta(
  overrides: Partial<SlowQueriesExportDocument['metadata']> = {},
): SlowQueriesExportDocument['metadata'] {
  return {
    mongoscopeVersion: '0.2.1',
    source: 'static',
    label: 'mongod.log',
    windowStartMs: 1_000,
    windowEndMs: 2_000,
    exportedAt: '2026-10-08T10:30:00.000Z',
    sort: { by: 'count', direction: 'desc' },
    patternCount: 0,
    ...overrides,
  }
}

function detail(overrides: Partial<ExportableQueryDetail> = {}): ExportableQueryDetail {
  return {
    planSummary: 'IXSCAN { status: 1 }',
    filter: '{ "status": "pending" }',
    docsExamined: 40,
    nReturned: 2,
    totalMillis: 180,
    stageDetail: 'IXSCAN',
    suggestedIndexCommand: null,
    suggestedIndexReason: null,
    timestamp: '2026-10-08T10:00:00.000Z',
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
    command: '{ "find": "users" }',
    ...overrides,
  }
}

function pattern(overrides: Partial<ExportablePattern> = {}): ExportablePattern {
  return {
    namespace: 'app.users',
    op: 'find',
    shape: '{status:1}',
    count: 3,
    avgMs: 120,
    avgDocsExamined: 40,
    avgDocsReturned: 2,
    plan: 'IXSCAN',
    totalDurationMs: 360,
    detail: detail(),
    ...overrides,
  }
}

function doc(
  patterns: ExportablePattern[],
  metadataOverrides: Partial<SlowQueriesExportDocument['metadata']> = {},
): SlowQueriesExportDocument {
  return {
    metadata: meta({ patternCount: patterns.length, ...metadataOverrides }),
    patterns,
  }
}

describe('serializeSlowQueriesJson', () => {
  it('serializes an empty pattern list with metadata', () => {
    const text = serializeSlowQueriesJson(doc([]))
    const parsed = JSON.parse(text) as SlowQueriesExportDocument
    expect(parsed.metadata.patternCount).toBe(0)
    expect(parsed.patterns).toEqual([])
    expect(parsed.metadata).not.toHaveProperty('trendBucketCount')
  })

  it('keeps numbers as numbers and nests query detail', () => {
    const text = serializeSlowQueriesJson(doc([pattern()]))
    const parsed = JSON.parse(text) as SlowQueriesExportDocument
    expect(parsed.patterns[0]!.count).toBe(3)
    expect(parsed.patterns[0]!).not.toHaveProperty('trend')
    expect(parsed.patterns[0]!.detail!.filter).toContain('pending')
    expect(parsed.patterns[0]!.detail!.command).toContain('find')
    expect(typeof parsed.patterns[0]!.detail!.docsExamined).toBe('number')
  })

  it('preserves unicode in namespace and shape', () => {
    const text = serializeSlowQueriesJson(
      doc([pattern({ namespace: 'アプリ.ユーザー', shape: '{名前:1}' })]),
    )
    expect(text).toContain('アプリ.ユーザー')
    expect(text).toContain('{名前:1}')
  })
})

describe('serializeSlowQueriesCsv', () => {
  it('emits a header row for an empty list', () => {
    const text = serializeSlowQueriesCsv(doc([]))
    expect(text.startsWith('namespace,op,shape,')).toBe(true)
    expect(text).toContain('detailFilter')
    expect(text).toContain('detailCommand')
    expect(text).not.toContain(',trend')
  })

  it('emits pattern and detail columns for a single row', () => {
    const text = serializeSlowQueriesCsv(doc([pattern()]))
    const lines = text.trimEnd().split('\n')
    expect(lines).toHaveLength(2)
    expect(lines[1]).toContain('app.users,find,{status:1},3,120')
    expect(lines[1]).toContain('pending')
    expect(lines[1]).toContain('find')
  })

  it('RFC 4180-quotes commas, quotes, and newlines in string cells', () => {
    const text = serializeSlowQueriesCsv(
      doc([
        pattern({
          namespace: 'db.a,b',
          shape: '{a:"x", b:1}',
          plan: 'line1\nline2',
          detail: detail({ filter: '{\n  "a": 1\n}' }),
        }),
      ]),
    )
    expect(text).toContain('"db.a,b"')
    expect(text).toContain('"{a:""x"", b:1}"')
    expect(text).toContain('"line1\nline2"')
  })

  it('neutralizes formula-leading string cells but not numeric columns', () => {
    const text = serializeSlowQueriesCsv(
      doc([
        pattern({
          namespace: '=cmd|a',
          op: '+find',
          shape: '-{x:1}',
          plan: '@SUM(1)',
          count: 0,
          avgMs: -5,
          avgDocsExamined: 0,
          avgDocsReturned: -1,
          totalDurationMs: 0,
          detail: detail({ filter: '=1+1', command: '+cmd' }),
        }),
      ]),
    )
    expect(text).toContain("'=cmd|a")
    expect(text).toContain("'+find")
    expect(text).toContain("'-{x:1}")
    expect(text).toContain("'@SUM(1)")
    expect(text).toContain("'=1+1")
    expect(text).toContain("'+cmd")
    expect(text).toMatch(/,0,-5,0,-1,/)
    expect(text).not.toMatch(/,'0/)
    expect(text).not.toMatch(/,'-5/)
  })

  it('preserves unicode', () => {
    const text = serializeSlowQueriesCsv(doc([pattern({ namespace: 'db.café' })]))
    expect(text).toContain('db.café')
  })

  it('keeps very long string values intact inside quotes', () => {
    const longNs = `db.${'x'.repeat(500)}`
    const text = serializeSlowQueriesCsv(doc([pattern({ namespace: longNs })]))
    expect(text).toContain(longNs)
  })
})

describe('serializeSlowQueriesMarkdown', () => {
  it('renders a heading and empty summary table for an empty list', () => {
    const text = serializeSlowQueriesMarkdown(doc([]))
    expect(text).toContain('# Slow query patterns')
    expect(text).toContain('source: static')
    expect(text).toContain('patterns: 0')
    expect(text).toContain('| namespace | op |')
    expect(text).not.toContain('## Query detail')
  })

  it('escapes pipes and newlines in the summary table', () => {
    const text = serializeSlowQueriesMarkdown(
      doc([
        pattern({
          namespace: 'db.a|b',
          shape: 'line1\nline2',
        }),
      ]),
    )
    expect(text).toContain('db.a\\|b')
    expect(text).toContain('line1 line2')
  })

  it('includes query detail sections with filter and command', () => {
    const text = serializeSlowQueriesMarkdown(doc([pattern()]))
    expect(text).toContain('## Query detail')
    expect(text).toContain('Filter / pipeline')
    expect(text).toContain('pending')
    expect(text).toContain('Command')
    expect(text).toContain('find')
    expect(text).not.toContain('trend')
  })

  it('truncates very long values in the summary table', () => {
    const long = 'x'.repeat(200)
    const text = serializeSlowQueriesMarkdown(doc([pattern({ namespace: long })]))
    const tableRow = text
      .split('\n')
      .find((line) => line.startsWith('| x') && line.includes('find'))
    expect(tableRow).toBeDefined()
    expect(tableRow).toContain('…')
    expect(tableRow!.length).toBeLessThan(long.length + 40)
  })

  it('preserves unicode', () => {
    const text = serializeSlowQueriesMarkdown(doc([pattern({ namespace: 'db.東京' })]))
    expect(text).toContain('db.東京')
  })
})
