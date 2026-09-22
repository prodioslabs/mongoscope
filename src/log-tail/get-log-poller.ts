import { asDriverErrorLike } from '../lib/driver-error'
import { isUnauthorizedError } from '../lib/mongo-unauthorized-error'
import { diffGetLogLines } from './diff-get-log'
import { extractGetLogLines } from './get-log-lines'
import { parseTailLogLineFromText } from './parse-tail-line'
import { LogLineRingBuffer } from './ring-buffer'
import {
  LOG_TAIL_RING_CAPACITY,
  type LogTailFormat,
  type LogTailStats,
  type TailLogLine,
} from './types'

/** Default poll interval for getLog (heavier than file stat polls). */
const GET_LOG_POLL_INTERVAL_MS = 1000

export type GetLogSnapshot = {
  lines: TailLogLine[]
  stats: LogTailStats
  running: boolean
  error: string | null
  /** Raw string lines from the last successful poll (for tests / overlap). */
  lastRawLines: string[]
}

export type GetLogPoller = {
  start(): Promise<void>
  stop(): void
  pollOnce(): Promise<void>
  getSnapshot(): GetLogSnapshot
  subscribe(listener: () => void): () => void
}

export type GetLogPollerOptions = {
  /** Fetch raw getLog:'global' command result. */
  fetchLog: () => Promise<unknown>
  pollIntervalMs?: number
  ringCapacity?: number
  now?: () => number
}

/**
 * Polls `getLog: 'global'`, diffs against the previous window, and appends only
 * new lines into the shared ring buffer. Retention is the server RAM ring
 * (~1024 events) — not a durable on-disk log.
 */
export function createGetLogPoller(options: GetLogPollerOptions): GetLogPoller {
  const pollIntervalMs = options.pollIntervalMs ?? GET_LOG_POLL_INTERVAL_MS
  const now = options.now ?? (() => Date.now())
  const ring = new LogLineRingBuffer(options.ringCapacity ?? LOG_TAIL_RING_CAPACITY)
  const listeners = new Set<() => void>()

  let running = false
  let seeded = false
  let timer: ReturnType<typeof setInterval> | null = null
  let tickInFlight = false
  let previousRaw: string[] = []
  let restartsDetected = 0
  let seenJson = false
  let error: string | null = null
  const ingestTimestamps: number[] = []

  function emit(): void {
    for (const listener of listeners) {
      listener()
    }
  }

  function recordIngest(count: number): void {
    if (count <= 0) {
      return
    }
    const t = now()
    for (let i = 0; i < count; i++) {
      ingestTimestamps.push(t)
    }
    const cutoff = t - 1000
    while (ingestTimestamps.length > 0 && ingestTimestamps[0]! < cutoff) {
      ingestTimestamps.shift()
    }
  }

  function linesPerSec(): number {
    const t = now()
    const cutoff = t - 1000
    let count = 0
    for (let i = ingestTimestamps.length - 1; i >= 0; i--) {
      if (ingestTimestamps[i]! < cutoff) {
        break
      }
      count++
    }
    return count
  }

  function formatLabel(): LogTailFormat {
    return seenJson ? 'JSON (4.4+)' : 'raw/legacy'
  }

  function buildStats(): LogTailStats {
    return {
      format: formatLabel(),
      linesPerSec: linesPerSec(),
      restartsDetected,
      bufferedCount: ring.size,
    }
  }

  function ingestRawLines(rawLines: string[]): void {
    for (const raw of rawLines) {
      const line = parseTailLogLineFromText(raw)
      ring.push(line)
      if (line.kind === 'json') {
        seenJson = true
      }
    }
    recordIngest(rawLines.length)
  }

  async function pollTick(): Promise<void> {
    if (!running || tickInFlight) {
      return
    }
    tickInFlight = true
    try {
      const raw = await options.fetchLog()
      const current = extractGetLogLines(raw)
      const { newLines, wrapped } = diffGetLogLines(previousRaw, current)
      if (wrapped && previousRaw.length > 0) {
        restartsDetected++
      }
      if (newLines.length > 0) {
        ingestRawLines(newLines)
      }
      previousRaw = current
      error = null
      emit()
    } catch (err) {
      error = formatGetLogError(err)
      emit()
    } finally {
      tickInFlight = false
    }
  }

  return {
    async start() {
      if (running) {
        return
      }
      running = true
      error = null
      if (!seeded) {
        try {
          const raw = await options.fetchLog()
          const current = extractGetLogLines(raw)
          previousRaw = current
          ingestRawLines(current)
          seeded = true
          error = null
          emit()
        } catch (err) {
          error = formatGetLogError(err)
          emit()
        }
      }
      timer = setInterval(() => {
        void pollTick()
      }, pollIntervalMs)
      if (typeof timer === 'object' && timer !== null && 'unref' in timer) {
        ;(timer as { unref: () => void }).unref()
      }
    },

    stop() {
      running = false
      if (timer != null) {
        clearInterval(timer)
        timer = null
      }
      emit()
    },

    async pollOnce() {
      await pollTick()
    },

    getSnapshot() {
      return {
        lines: ring.toArray(),
        stats: buildStats(),
        running,
        error,
        lastRawLines: previousRaw.slice(),
      }
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

function formatGetLogError(err: unknown): string {
  if (isUnauthorizedError(err)) {
    return 'insufficient permissions (needs getLog / clusterMonitor)'
  }
  const record = asDriverErrorLike(err)
  if (record == null) {
    return err instanceof Error ? err.message : String(err)
  }
  if (typeof record.message === 'string' && record.message.trim() !== '') {
    return record.message
  }
  return 'failed to fetch getLog'
}
