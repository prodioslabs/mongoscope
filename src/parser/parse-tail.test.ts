import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  clampLogTailLines,
  formatLogTailPreset,
  nextLogTailPreset,
  parseLogFileTail,
  parseLogTailLinesInput,
  DEFAULT_LOG_TAIL_LINES,
  LOG_TAIL_LINE_PRESETS,
  MAX_LOG_TAIL_LINES,
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
  it('keeps only the last maxLines and matches EOF content', async () => {
    const lines = Array.from({ length: 20 }, (_, i) => {
      const n = String(i + 1).padStart(2, '0')
      return `{"t":{"$date":"2024-01-01T00:00:${n}.000Z"},"s":"I","c":"COMMAND","id":1,"ctx":"conn1","msg":"line-${n}","attr":{"ns":"db.col","durationMillis":200}}`
    })
    const path = await writeFixture(lines)
    const store = await parseLogFileTail(path, { maxLines: 5 })
    expect(store.rowCount).toBe(5)
    expect(store.getEntry(store.rowCount - 1).msg).toBe('line-20')
  })

  it('returns the whole file when shorter than maxLines', async () => {
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
  it('default is 100k across the dialog presets', () => {
    expect(DEFAULT_LOG_TAIL_LINES).toBe(100_000)
    expect(LOG_TAIL_LINE_PRESETS).toEqual([10_000, 25_000, 50_000, 100_000, 250_000])
    expect(nextLogTailPreset(100_000)).toBe(250_000)
    expect(nextLogTailPreset(999)).toBe(DEFAULT_LOG_TAIL_LINES)
  })

  it('formatLogTailPreset uses exact k suffix for round thousands', () => {
    expect(formatLogTailPreset(10_000)).toBe('10k')
    expect(formatLogTailPreset(25_000)).toBe('25k')
    expect(formatLogTailPreset(100_000)).toBe('100k')
    expect(formatLogTailPreset(500)).toBe('500')
  })

  it('parseLogTailLinesInput accepts digits and k suffix', () => {
    expect(parseLogTailLinesInput('75000')).toBe(75_000)
    expect(parseLogTailLinesInput('75k')).toBe(75_000)
    expect(parseLogTailLinesInput(' 10,000 ')).toBe(10_000)
    expect(parseLogTailLinesInput('0')).toBeNull()
    expect(parseLogTailLinesInput('abc')).toBeNull()
    expect(parseLogTailLinesInput(String(MAX_LOG_TAIL_LINES + 1))).toBeNull()
  })

  it('clampLogTailLines bounds values', () => {
    expect(clampLogTailLines(0)).toBe(1)
    expect(clampLogTailLines(MAX_LOG_TAIL_LINES + 5)).toBe(MAX_LOG_TAIL_LINES)
    expect(clampLogTailLines(12_345.9)).toBe(12_345)
  })
})
