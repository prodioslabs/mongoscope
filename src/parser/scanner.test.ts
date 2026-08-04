import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  parseIsoTimestampBytes,
  parseLogFile,
  scanBytes,
  scanHotFields,
} from './scanner'
import { readEntryDetail } from './index'
import { LogStore } from './store'

const encoder = new TextEncoder()

function line(overrides?: {
  date?: string
  s?: string
  c?: string
  id?: number
  ctx?: string
  msg?: string
}): string {
  const date = overrides?.date ?? '2026-04-08T22:54:28.761+05:30'
  const s = overrides?.s ?? 'I'
  const c = overrides?.c ?? 'COMMAND'
  const id = overrides?.id ?? 51803
  const ctx = overrides?.ctx ?? 'conn232'
  const msg = overrides?.msg ?? 'Slow query'
  return `{"t":{"$date":"${date}"},"s":"${s}",  "c":"${c}",  "id":${id},   "ctx":"${ctx}","msg":"${msg}","attr":{"x":1}}`
}

const tempDirs: string[] = []

afterEach(async function cleanupTempDirs() {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir) await rm(dir, { recursive: true, force: true })
  }
})

async function writeTempLog(content: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'mongoscope-parser-'))
  tempDirs.push(dir)
  const path = join(dir, 'test.log')
  await writeFile(path, content)
  return path
}

describe('parseIsoTimestampBytes', () => {
  it('parses offset +05:30', () => {
    const s = '2026-04-08T22:54:28.761+05:30'
    const buf = encoder.encode(s)
    const ms = parseIsoTimestampBytes(buf, 0, buf.length)
    expect(ms).toBe(Date.parse(s))
  })

  it('parses Zulu timestamps', () => {
    const s = '2024-01-01T00:00:00.000Z'
    const buf = encoder.encode(s)
    expect(parseIsoTimestampBytes(buf, 0, buf.length)).toBe(Date.parse(s))
  })

  it('returns NaN for garbage', () => {
    const buf = encoder.encode('not-a-date')
    expect(Number.isNaN(parseIsoTimestampBytes(buf, 0, buf.length))).toBe(true)
  })
})

describe('scanHotFields', () => {
  it('extracts hot fields from mongod-shaped lines', () => {
    const buf = encoder.encode(line())
    const hot = scanHotFields(buf, 0, buf.length)
    expect(hot).not.toBeNull()
    expect(hot!.component).toBe('COMMAND')
    expect(hot!.id).toBe(51803)
    expect(hot!.ctx).toBe('conn232')
    expect(hot!.msg).toBe('Slow query')
    expect(hot!.severity).toBe(3)
  })
})

describe('scanBytes', () => {
  it('handles CRLF line endings', () => {
    const store = new LogStore('mem://crlf')
    const body = `${line()}\r\n${line({ id: 1 })}\r\n`
    scanBytes(store, encoder.encode(body))
    expect(store.rowCount).toBe(2)
    expect(store.getEntry(0).id).toBe(51803)
    expect(store.getEntry(1).id).toBe(1)
    // lengths exclude CR
    expect(store.lengths[0]).toBe(encoder.encode(line()).length)
  })

  it('handles truncated final line without trailing newline', () => {
    const store = new LogStore('mem://trunc')
    scanBytes(store, encoder.encode(line({ id: 42 })))
    expect(store.rowCount).toBe(1)
    expect(store.getEntry(0).id).toBe(42)
  })

  it('handles lines spanning chunk boundaries', () => {
    const store = new LogStore('mem://span')
    const a = line({ id: 1 })
    const b = line({ id: 2 })
    const body = encoder.encode(`${a}\n${b}\n`)
    // Force tiny chunks so the first line spans multiple chunks
    scanBytes(store, body, { chunkSize: 17 })
    expect(store.rowCount).toBe(2)
    expect(store.getEntry(0).id).toBe(1)
    expect(store.getEntry(1).id).toBe(2)
  })

  it('handles multi-byte UTF-8 split across chunks', () => {
    const store = new LogStore('mem://utf8')
    const msg = 'café 日本語 🚀'
    const body = encoder.encode(`${line({ msg })}\n`)
    // Chunk size 1 guarantees multi-byte sequences are split
    scanBytes(store, body, { chunkSize: 1 })
    expect(store.rowCount).toBe(1)
    expect(store.getEntry(0).msg).toBe(msg)
  })

  it('marks non-JSON legacy lines as raw', () => {
    const store = new LogStore('mem://legacy')
    const legacy = '2024-01-01T00:00:00.000+0000 I CONTROL [init] hello'
    scanBytes(store, encoder.encode(`${legacy}\n`))
    expect(store.rowCount).toBe(1)
    const entry = store.getEntry(0)
    expect(entry.kind).toBe('raw')
    expect(entry.msg).toBe(legacy)
  })

  it('marks malformed JSON as raw', () => {
    const store = new LogStore('mem://badjson')
    scanBytes(store, encoder.encode('{"t": broken\n'))
    expect(store.rowCount).toBe(1)
    expect(store.getEntry(0).kind).toBe('raw')
  })

  it('handles empty file', () => {
    const store = new LogStore('mem://empty')
    scanBytes(store, new Uint8Array())
    expect(store.rowCount).toBe(0)
  })

  it('falls back to JSON.parse for reordered fields', () => {
    const store = new LogStore('mem://reorder')
    // Valid mongod-like object but field order differs — hot path fails, JSON works
    const reordered =
      '{"s":"I","c":"COMMAND","id":9,"ctx":"c1","msg":"hi","t":{"$date":"2024-01-01T00:00:00.000Z"}}'
    scanBytes(store, encoder.encode(`${reordered}\n`))
    expect(store.rowCount).toBe(1)
    const entry = store.getEntry(0)
    expect(entry.kind).toBe('json')
    expect(entry.id).toBe(9)
    expect(entry.msg).toBe('hi')
  })
})

describe('parseLogFile + readEntryDetail', () => {
  it('yields progressive batches and supports lazy detail', async () => {
    const lines = Array.from({ length: 120 }, (_, i) =>
      line({ id: i, msg: `m${i}` }),
    ).join('\n')
    const path = await writeTempLog(`${lines}\n`)

    const batches: { start: number; end: number }[] = []
    let store: LogStore | null = null
    for await (const batch of parseLogFile(path, { batchSize: 50 })) {
      batches.push({ start: batch.start, end: batch.end })
      store = batch.store
    }

    expect(store).not.toBeNull()
    expect(store!.rowCount).toBe(120)
    expect(batches).toEqual([
      { start: 0, end: 50 },
      { start: 50, end: 100 },
      { start: 100, end: 120 },
    ])

    const detail = await readEntryDetail(store!, 3)
    expect(detail.id).toBe(3)
    expect(detail.attr).toEqual({ x: 1 })
    expect(detail.raw).toMatchObject({ id: 3 })
  })

  it('yields an empty batch for an empty file', async () => {
    const path = await writeTempLog('')
    const batches = []
    for await (const batch of parseLogFile(path)) {
      batches.push({ start: batch.start, end: batch.end, rows: batch.store.rowCount })
    }
    expect(batches).toEqual([{ start: 0, end: 0, rows: 0 }])
  })
})
