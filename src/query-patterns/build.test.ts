import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { parseLogFile } from '../parser'
import { buildQueryPatternStore } from './build'
import { getPatternExplain } from './explain'
import { SLOW_QUERY_ID, TREND_BUCKETS } from './types'

const tempDirs: string[] = []

afterEach(async function cleanupTempDirs() {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir) await rm(dir, { recursive: true, force: true })
  }
})

async function writeTempLog(content: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'mongoscope-qp-'))
  tempDirs.push(dir)
  const path = join(dir, 'test.log')
  await writeFile(path, content)
  return path
}

async function parseStore(content: string) {
  const path = await writeTempLog(content)
  let store = null
  for await (const batch of parseLogFile(path)) {
    store = batch.store
  }
  return store!
}

function slowLine(opts: {
  date: string
  ns: string
  filter: Record<string, unknown>
  durationMillis: number
  docsExamined?: number
  nreturned?: number
  planSummary?: string
  id?: number
  msg?: string
}): string {
  const id = opts.id ?? SLOW_QUERY_ID
  const msg = opts.msg ?? 'Slow query'
  const attr = {
    type: 'command',
    ns: opts.ns,
    command: {
      find: opts.ns.split('.')[1] ?? 'col',
      filter: opts.filter,
      $db: opts.ns.split('.')[0] ?? 'db',
    },
    planSummary: opts.planSummary ?? 'COLLSCAN',
    docsExamined: opts.docsExamined ?? 0,
    nreturned: opts.nreturned ?? 0,
    durationMillis: opts.durationMillis,
  }
  return JSON.stringify({
    t: { $date: opts.date },
    s: 'I',
    c: 'COMMAND',
    id,
    ctx: 'conn1',
    msg,
    attr,
  })
}

describe('buildQueryPatternStore', () => {
  it('aggregates matching shapes and ignores non-slow rows', async () => {
    const lines = [
      slowLine({
        date: '2026-04-08T10:00:00.000Z',
        ns: 'govdb.applications',
        filter: { status: 'pending', district: 'dehradun' },
        durationMillis: 100,
        docsExamined: 1000,
        nreturned: 10,
      }),
      slowLine({
        date: '2026-04-08T10:05:00.000Z',
        ns: 'govdb.applications',
        filter: { status: 'done', district: 'nainital' },
        durationMillis: 300,
        docsExamined: 2000,
        nreturned: 20,
      }),
      slowLine({
        date: '2026-04-08T10:10:00.000Z',
        ns: 'govdb.candidates',
        filter: { email: 'a@b.c' },
        durationMillis: 50,
        docsExamined: 5,
        nreturned: 1,
        planSummary: 'IXSCAN { email: 1 }',
      }),
      // different msg id — ignored
      slowLine({
        date: '2026-04-08T10:15:00.000Z',
        ns: 'govdb.applications',
        filter: { status: 'x' },
        durationMillis: 999,
        id: 1,
        msg: 'Connection ended',
      }),
    ].join('\n')

    const store = await parseStore(lines + '\n')
    const patterns = await buildQueryPatternStore(store)

    expect(patterns.slowQueryCount).toBe(3)
    expect(patterns.patterns).toHaveLength(2)

    const apps = patterns.patterns.find((p) => p.namespace === 'govdb.applications')!
    expect(apps.count).toBe(2)
    expect(apps.shape).toBe('{district:1, status:1}')
    expect(apps.avgMs).toBe(200) // (100+300)/2
    expect(apps.avgDocsExamined).toBe(1500)
    expect(apps.avgDocsReturned).toBe(15)
    expect(apps.plan).toBe('COLLSCAN')
    expect(apps.sampleRow).toBe(1) // slower 300ms row
    expect(apps.trend).toBeInstanceOf(Uint16Array)
    expect(apps.trend.length).toBe(TREND_BUCKETS)

    const candidates = patterns.patterns.find((p) => p.namespace === 'govdb.candidates')!
    expect(candidates.count).toBe(1)
    expect(candidates.plan).toBe('IXSCAN')

    // Sorted by count desc
    expect(patterns.patterns[0]!.namespace).toBe('govdb.applications')
  })

  it('picks slowest sample row for explain', async () => {
    const lines = [
      slowLine({
        date: '2026-04-08T10:00:00.000Z',
        ns: 'govdb.applications',
        filter: { status: 'pending' },
        durationMillis: 50,
        docsExamined: 10,
        nreturned: 1,
      }),
      slowLine({
        date: '2026-04-08T10:01:00.000Z',
        ns: 'govdb.applications',
        filter: { status: 'other' },
        durationMillis: 842,
        docsExamined: 96400,
        nreturned: 40,
      }),
    ].join('\n')

    const store = await parseStore(lines + '\n')
    const patterns = await buildQueryPatternStore(store)
    expect(patterns.patterns).toHaveLength(1)
    expect(patterns.patterns[0]!.sampleRow).toBe(1)

    const explain = await getPatternExplain(store, patterns, 0)
    expect(explain.namespace).toBe('govdb.applications')
    expect(explain.plan).toBe('COLLSCAN')
    expect(explain.docsExamined).toBe(96400)
    expect(explain.nReturned).toBe(40)
    expect(explain.totalMillis).toBe(842)
    expect(explain.filter).toContain('status')
    expect(explain.stageDetail).toContain('COLLSCAN')
    expect(explain.suggestedIndex).not.toBeNull()
    expect(explain.suggestedIndex!.command).toBe('db.applications.createIndex({ status: 1 })')
  })

  it('returns empty store when no slow queries', async () => {
    const line = slowLine({
      date: '2026-04-08T10:00:00.000Z',
      ns: 'govdb.applications',
      filter: { a: 1 },
      durationMillis: 1,
      id: 42,
      msg: 'other',
    })
    const store = await parseStore(line + '\n')
    const patterns = await buildQueryPatternStore(store)
    expect(patterns.patterns).toEqual([])
    expect(patterns.slowQueryCount).toBe(0)
  })
})
