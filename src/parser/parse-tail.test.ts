import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  formatLogTailPreset,
  nextLogTailPreset,
  parseLogFileTail,
  DEFAULT_LOG_TAIL_LINES,
  LOG_TAIL_LINE_PRESETS,
} from './parse-tail'

const dirs: string[] = []

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

async function writeFixture(lines: string[]): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'parse-tail-'))
  dirs.push(dir)
  const path = join(dir, 'mongod.log')
  await writeFile(path, lines.join('\n') + '\n', 'utf8')
  return path
}

describe('parseLogFileTail', () => {
  test('keeps only the last maxLines and matches EOF content', async () => {
    const lines = Array.from({ length: 20 }, (_, i) => {
      const n = String(i + 1).padStart(2, '0')
      return `{"t":{"$date":"2024-01-01T00:00:${n}.000Z"},"s":"I","c":"COMMAND","id":1,"ctx":"conn1","msg":"line-${n}","attr":{"ns":"db.col","durationMillis":200}}`
    })
    const path = await writeFixture(lines)
    const store = await parseLogFileTail(path, { maxLines: 5 })
    expect(store.rowCount).toBe(5)
    expect(store.getEntry(store.rowCount - 1).msg).toBe('line-20')
  })

  test('returns the whole file when shorter than maxLines', async () => {
    const lines = [
      '{"t":{"$date":"2024-01-01T00:00:01.000Z"},"s":"I","c":"COMMAND","id":1,"ctx":"conn1","msg":"a","attr":{"ns":"db.col","durationMillis":200}}',
      '{"t":{"$date":"2024-01-01T00:00:02.000Z"},"s":"I","c":"COMMAND","id":1,"ctx":"conn1","msg":"b","attr":{"ns":"db.col","durationMillis":200}}',
    ]
    const path = await writeFixture(lines)
    const store = await parseLogFileTail(path, { maxLines: 100 })
    expect(store.rowCount).toBe(2)
  })
})

describe('logTailLine presets', () => {
  test('default is 100k and cycle visits every preset', () => {
    expect(DEFAULT_LOG_TAIL_LINES).toBe(100_000)
    expect(LOG_TAIL_LINE_PRESETS).toEqual([50_000, 100_000, 250_000, 500_000])

    let current: number = DEFAULT_LOG_TAIL_LINES
    const seen = new Set<number>()
    for (let i = 0; i < LOG_TAIL_LINE_PRESETS.length; i++) {
      current = nextLogTailPreset(current)
      seen.add(current)
    }
    expect(seen.size).toBe(LOG_TAIL_LINE_PRESETS.length)
    expect(nextLogTailPreset(999)).toBe(DEFAULT_LOG_TAIL_LINES)
  })

  test('formatLogTailPreset uses k suffix', () => {
    expect(formatLogTailPreset(50_000)).toBe('50k')
    expect(formatLogTailPreset(100_000)).toBe('100k')
    expect(formatLogTailPreset(500)).toBe('500')
  })
})
