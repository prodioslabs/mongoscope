#!/usr/bin/env bun
/* eslint-disable no-console */

import { existsSync, mkdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LogStore, parseLogFile } from '../src/parser'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const FIXTURE = join(root, 'mongod_latest_tail_100k.log')
const SYNTHETIC_LINES = 1_000_000

type BenchResult = {
  label: string
  bytes: number
  lines: number
  ms: number
  mbPerSec: number
  linesPerSec: number
  rssDeltaMb: number
  heapDeltaMb: number
  storeEstimateMb?: number
}

function gc(): void {
  try {
    Bun.gc(true)
  } catch {
    // ignore
  }
}

function mem() {
  return process.memoryUsage()
}

function fmtMb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1)
}

function printResult(r: BenchResult): void {
  console.log(`\n=== ${r.label} ===`)
  console.log(`  size:        ${fmtMb(r.bytes)} MB  /  ${r.lines.toLocaleString()} lines`)
  console.log(`  time:        ${r.ms.toFixed(1)} ms`)
  console.log(
    `  throughput:  ${r.mbPerSec.toFixed(1)} MB/s  |  ${Math.round(r.linesPerSec).toLocaleString()} lines/s`,
  )
  console.log(`  rss Δ:       ${r.rssDeltaMb.toFixed(1)} MB`)
  console.log(`  heap Δ:      ${r.heapDeltaMb.toFixed(1)} MB`)
  if (r.storeEstimateMb !== undefined) {
    console.log(`  store est.:  ${r.storeEstimateMb.toFixed(1)} MB`)
  }
}

function makeLine(i: number): string {
  const sev = i % 17 === 0 ? 'W' : 'I'
  const component = i % 5 === 0 ? 'STORAGE' : 'COMMAND'
  const id = i % 5 === 0 ? 22402 : 51803
  const ctx = `conn${i % 200}`
  const msg = i % 5 === 0 ? 'WiredTiger record store oplog truncation finished' : 'Slow query'
  const ms = String(i % 1000).padStart(3, '0')
  const date = `2026-04-08T22:54:28.${ms}+05:30`
  return `{"t":{"$date":"${date}"},"s":"${sev}",  "c":"${component}",  "id":${id},   "ctx":"${ctx}","msg":"${msg}","attr":{"type":"command","ns":"db.col","ninserted":1000,"durationMillis":${i % 200},"remote":"127.0.0.1:45566"}}`
}

function generateSynthetic(path: string, lineCount: number): number {
  mkdirSync(dirname(path), { recursive: true })
  const batchSize = 10_000
  const chunks: string[] = []
  let total = 0
  let first = true

  const flush = (): void => {
    if (chunks.length === 0) return
    const block = `${chunks.join('\n')}\n`
    if (first) {
      writeFileSync(path, block)
      first = false
    } else {
      writeFileSync(path, block, { flag: 'a' })
    }
    total += Buffer.byteLength(block)
    chunks.length = 0
  }

  for (let i = 0; i < lineCount; i++) {
    chunks.push(makeLine(i))
    if (chunks.length >= batchSize) flush()
  }
  flush()
  return total
}

async function benchScanner(
  path: string,
  label: string,
): Promise<{ result: BenchResult; store: LogStore }> {
  gc()
  await Bun.sleep(50)
  gc()
  const before = mem()
  const t0 = performance.now()

  let store: LogStore | null = null
  for await (const batch of parseLogFile(path)) {
    store = batch.store
  }

  const ms = performance.now() - t0
  if (!store) throw new Error('parseLogFile yielded no batches')

  // Keep a live reference so GC cannot collect the store before we measure.
  const keep = store
  gc()
  await Bun.sleep(50)
  gc()
  const after = mem()

  const bytes = keep.byteLength || (existsSync(path) ? statSync(path).size : 0)
  const estimate = keep.memoryEstimate()

  return {
    store: keep,
    result: {
      label,
      bytes,
      lines: keep.rowCount,
      ms,
      mbPerSec: bytes / (1024 * 1024) / (ms / 1000),
      linesPerSec: keep.rowCount / (ms / 1000),
      rssDeltaMb: (after.rss - before.rss) / (1024 * 1024),
      heapDeltaMb: (after.heapUsed - before.heapUsed) / (1024 * 1024),
      storeEstimateMb: estimate.totalBytes / (1024 * 1024),
    },
  }
}

function iterateUtf8Lines(fileText: string): string[] {
  const lines = fileText.split('\n')
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop()
  }
  return lines.map((line) => (line.endsWith('\r') ? line.slice(0, -1) : line))
}

async function benchNaive(path: string, label: string): Promise<BenchResult> {
  gc()
  await Bun.sleep(50)
  gc()
  const before = mem()
  const t0 = performance.now()

  type Row = {
    t: number
    s: string
    c: string
    id: number
    ctx: string
    msg: string
    raw: unknown
  }
  const rows: Row[] = []

  for (const text of iterateUtf8Lines(await Bun.file(path).text())) {
    try {
      const obj = JSON.parse(text) as {
        t?: { $date?: string }
        s?: string
        c?: string
        id?: number
        ctx?: string
        msg?: string
      }
      rows.push({
        t: obj.t?.$date ? Date.parse(obj.t.$date) : Number.NaN,
        s: obj.s ?? '',
        c: obj.c ?? '',
        id: obj.id ?? 0,
        ctx: obj.ctx ?? '',
        msg: obj.msg ?? '',
        raw: obj,
      })
    } catch {
      rows.push({
        t: Number.NaN,
        s: '',
        c: '',
        id: 0,
        ctx: '',
        msg: text,
        raw: text,
      })
    }
  }

  const ms = performance.now() - t0
  // Keep rows alive across GC for a fair resident-set measurement.
  const keep = rows
  gc()
  await Bun.sleep(50)
  gc()
  const after = mem()
  const bytes = existsSync(path) ? statSync(path).size : 0

  return {
    label,
    bytes,
    lines: keep.length,
    ms,
    mbPerSec: bytes / (1024 * 1024) / (ms / 1000),
    linesPerSec: keep.length / (ms / 1000),
    rssDeltaMb: (after.rss - before.rss) / (1024 * 1024),
    heapDeltaMb: (after.heapUsed - before.heapUsed) / (1024 * 1024),
  }
}

function printComparison(scanner: BenchResult, naive: BenchResult): void {
  const speedup = naive.ms / scanner.ms
  const memRatio = naive.heapDeltaMb / Math.max(scanner.heapDeltaMb, 0.01)
  console.log('\n--- comparison (scanner vs naive JSON.parse) ---')
  console.log(
    `  time:   ${scanner.ms.toFixed(1)} ms vs ${naive.ms.toFixed(1)} ms  (${speedup.toFixed(2)}x faster)`,
  )
  console.log(`  MB/s:   ${scanner.mbPerSec.toFixed(1)} vs ${naive.mbPerSec.toFixed(1)}`)
  console.log(
    `  heap Δ: ${scanner.heapDeltaMb.toFixed(1)} MB vs ${naive.heapDeltaMb.toFixed(1)} MB  (${memRatio.toFixed(2)}x)`,
  )
}

async function runFixture(): Promise<void> {
  if (!existsSync(FIXTURE)) {
    console.log(`\n[skip] fixture not found: ${FIXTURE}`)
    return
  }
  console.log(`\n## Fixture: ${FIXTURE}`)
  const { result: scanner, store } = await benchScanner(FIXTURE, 'byte scanner (fixture 100k)')
  printResult(scanner)
  const intern = store.memoryEstimate().internCounts
  console.log(`  interned: component=${intern.component} ctx=${intern.ctx} msg=${intern.msg}`)

  const naive = await benchNaive(FIXTURE, 'naive JSON.parse (fixture 100k)')
  printResult(naive)
  printComparison(scanner, naive)
}

async function runSynthetic(): Promise<void> {
  const path = join(tmpdir(), `mongoscope-synth-${SYNTHETIC_LINES}.log`)
  console.log(`\n## Synthetic: ${SYNTHETIC_LINES.toLocaleString()} lines → ${path}`)

  const genT0 = performance.now()
  const bytes = generateSynthetic(path, SYNTHETIC_LINES)
  console.log(`  generated ${fmtMb(bytes)} MB in ${(performance.now() - genT0).toFixed(0)} ms`)

  try {
    const { result: scanner, store } = await benchScanner(
      path,
      `byte scanner (synthetic ${SYNTHETIC_LINES / 1e6}M)`,
    )
    printResult(scanner)
    const intern = store.memoryEstimate().internCounts
    console.log(`  interned: component=${intern.component} ctx=${intern.ctx} msg=${intern.msg}`)

    const naive = await benchNaive(path, `naive JSON.parse (synthetic ${SYNTHETIC_LINES / 1e6}M)`)
    printResult(naive)
    printComparison(scanner, naive)
  } finally {
    try {
      unlinkSync(path)
    } catch {
      // ignore
    }
  }
}

console.log('mongoscope parser bench')
await runFixture()
await runSynthetic()
console.log('\ndone.')
