import { describe, expect, it } from 'vitest'
import { serializeSlowQueriesCsv } from './serialize-csv'
import { serializeSlowQueriesJson } from './serialize-json'
import { serializeSlowQueriesMarkdown } from './serialize-markdown'
import type { ExportablePattern, SlowQueriesExportDocument } from './types'

function meta(
  overrides: Partial<SlowQueriesExportDocument['metadata']> = {},
): SlowQueriesExportDocument['metadata'] {
  return {
    mongoscopeVersion: '0.2.1',
    source: 'static',
    label: 'mongod.log',
    windowStartMs: 1_000,
    windowEndMs: 2_000,
    trendBucketCount: 24,
    exportedAt: '2026-10-08T10:30:00.000Z',
    sort: { by: 'count', direction: 'desc' },
    patternCount: 0,
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
    trend: [0, 1, 2, 0],
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
    expect(parsed.metadata.exportedAt).toBe('2026-10-08T10:30:00.000Z')
  })

  it('keeps numbers as numbers for a single pattern', () => {
    const text = serializeSlowQueriesJson(doc([pattern()]))
    const parsed = JSON.parse(text) as SlowQueriesExportDocument
    expect(parsed.patterns).toHaveLength(1)
    expect(parsed.patterns[0]!.count).toBe(3)
    expect(parsed.patterns[0]!.avgMs).toBe(120)
    expect(parsed.patterns[0]!.trend).toEqual([0, 1, 2, 0])
    expect(typeof parsed.patterns[0]!.count).toBe('number')
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
    expect(text).toBe(
      'namespace,op,shape,count,avgMs,avgDocsExamined,avgDocsReturned,plan,totalDurationMs,trend\n',
    )
  })

  it('emits a single pattern row with semicolon-joined trend', () => {
    const text = serializeSlowQueriesCsv(doc([pattern()]))
    const lines = text.trimEnd().split('\n')
    expect(lines).toHaveLength(2)
    expect(lines[1]).toContain('app.users,find,{status:1},3,120,40,2,IXSCAN,360,0;1;2;0')
  })

  it('RFC 4180-quotes commas, quotes, and newlines in string cells', () => {
    const text = serializeSlowQueriesCsv(
      doc([
        pattern({
          namespace: 'db.a,b',
          shape: '{a:"x", b:1}',
          plan: 'line1\nline2',
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
        }),
      ]),
    )
    expect(text).toContain("'=cmd|a")
    expect(text).toContain("'+find")
    expect(text).toContain("'-{x:1}")
    expect(text).toContain("'@SUM(1)")
    // Numeric columns stay raw (including zero and negatives).
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
  it('renders a heading and empty table for an empty list', () => {
    const text = serializeSlowQueriesMarkdown(doc([]))
    expect(text).toContain('# Slow query patterns')
    expect(text).toContain('source: static')
    expect(text).toContain('patterns: 0')
    expect(text).toContain('| namespace | op |')
    expect(text).toContain('| --- | --- |')
  })

  it('escapes pipes and newlines so rows stay single-line', () => {
    const text = serializeSlowQueriesMarkdown(
      doc([
        pattern({
          namespace: 'db.a|b',
          shape: 'line1\nline2',
        }),
      ]),
    )
    const dataRows = text
      .trimEnd()
      .split('\n')
      .filter((line) => line.startsWith('|') && !line.includes('---') && !line.includes('namespace'))
    expect(dataRows).toHaveLength(1)
    expect(dataRows[0]).toContain('db.a\\|b')
    expect(dataRows[0]).toContain('line1 line2')
    expect(dataRows[0]).not.toMatch(/\n/)
  })

  it('truncates very long cell values', () => {
    const long = 'x'.repeat(200)
    const text = serializeSlowQueriesMarkdown(doc([pattern({ namespace: long })]))
    expect(text).toContain('…')
    expect(text).not.toContain(long)
  })

  it('uses a plain-text sparkline for trend', () => {
    const text = serializeSlowQueriesMarkdown(doc([pattern({ trend: [0, 4, 8, 2] })]))
    expect(text).toMatch(/[▁▂▃▄▅▆▇█]+/)
  })

  it('preserves unicode', () => {
    const text = serializeSlowQueriesMarkdown(doc([pattern({ namespace: 'db.東京' })]))
    expect(text).toContain('db.東京')
  })
})
