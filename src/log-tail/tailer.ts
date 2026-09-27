import { open, stat } from 'node:fs/promises'
import { errorMessageText } from '../lib/error-message'
import { appendTailChunk, skipPartialLeadingLine } from './append-chunk'
import { buildLogTailStats, createIngestRateTracker } from './ingest-rate'
import { LogLineRingBuffer } from './ring-buffer'
import {
  LOG_TAIL_POLL_INTERVAL_MS,
  LOG_TAIL_RING_CAPACITY,
  LOG_TAIL_SEED_BYTE_WINDOW,
  LOG_TAIL_SEED_LINE_TARGET,
  type LogTailStats,
  type TailLogLine,
} from './types'

export type LogTailSnapshot = {
  path: string
  lines: TailLogLine[]
  stats: LogTailStats
  offset: number
  running: boolean
  error: string | null
}

export type LogTailer = {
  start(): Promise<void>
  stop(): void
  /** Exposed for tests: one poll iteration. */
  pollOnce(): Promise<void>
  getSnapshot(): LogTailSnapshot
  subscribe(listener: () => void): () => void
}

export type LogTailerOptions = {
  path: string
  pollIntervalMs?: number
  ringCapacity?: number
  seedByteWindow?: number
  seedLineTarget?: number
  /** Injected for tests. */
  now?: () => number
}

type FileIdentity = {
  size: number
  ino: number | null
}

/**
 * Polls a log file for new bytes, seeds a trailing window, and maintains a ring buffer.
 * Does not call flushCarry on poll ticks — incomplete trailing lines stay in carry.
 */
export function createLogTailer(options: LogTailerOptions): LogTailer {
  const path = options.path
  const pollIntervalMs = options.pollIntervalMs ?? LOG_TAIL_POLL_INTERVAL_MS
  const seedByteWindow = options.seedByteWindow ?? LOG_TAIL_SEED_BYTE_WINDOW
  const seedLineTarget = options.seedLineTarget ?? LOG_TAIL_SEED_LINE_TARGET
  const now = options.now ?? (() => Date.now())

  const ring = new LogLineRingBuffer(options.ringCapacity ?? LOG_TAIL_RING_CAPACITY)
  const listeners = new Set<() => void>()

  let running = false
  let seeded = false
  let timer: NodeJS.Timeout | null = null
  let tickInFlight = false
  let offset = 0
  let carry: Uint8Array | null = null
  let carryFileOffset = 0
  let identity: FileIdentity | null = null
  let restartsDetected = 0
  let seenJson = false
  let error: string | null = null
  const { recordIngest, linesPerSec } = createIngestRateTracker(now)

  function emit(): void {
    for (const listener of listeners) {
      listener()
    }
  }

  function buildStats(): LogTailStats {
    return buildLogTailStats({
      seenJson,
      linesPerSec: linesPerSec(),
      restartsDetected,
      bufferedCount: ring.size,
    })
  }

  function markJsonFromRecent(linesAdded: number): void {
    if (linesAdded <= 0 || seenJson) {
      return
    }
    const all = ring.toArray()
    for (let i = all.length - linesAdded; i < all.length; i++) {
      if (all[i]?.kind === 'json') {
        seenJson = true
        return
      }
    }
  }

  function noteLines(linesAdded: number): void {
    recordIngest(linesAdded)
    markJsonFromRecent(linesAdded)
  }

  async function readIdentity(): Promise<FileIdentity> {
    const info = await stat(path)
    const ino = typeof info.ino === 'number' ? info.ino : null
    return { size: info.size, ino }
  }

  async function readRange(start: number, length: number): Promise<Uint8Array> {
    if (length <= 0) {
      return new Uint8Array(0)
    }
    const fh = await open(path, 'r')
    try {
      const buf = Buffer.allocUnsafe(length)
      const { bytesRead } = await fh.read(buf, 0, length, start)
      return new Uint8Array(buf.buffer, buf.byteOffset, bytesRead)
    } finally {
      await fh.close()
    }
  }

  function applyRotation(): void {
    restartsDetected++
    offset = 0
    carry = null
    carryFileOffset = 0
  }

  async function seedFromEnd(): Promise<void> {
    const info = await readIdentity()
    identity = info
    if (info.size === 0) {
      offset = 0
      carry = null
      carryFileOffset = 0
      return
    }

    const window = Math.min(info.size, seedByteWindow)
    const start = info.size - window
    let seedBytes = await readRange(start, window)
    let fileOffsetOfBytes = start
    if (start > 0) {
      const skipped = skipPartialLeadingLine(seedBytes)
      fileOffsetOfBytes = start + skipped.skipped
      seedBytes = skipped.bytes
    }

    const seedRing = new LogLineRingBuffer(Math.max(seedLineTarget, ring.maxCapacity))
    const seeded = appendTailChunk(seedRing, seedBytes, fileOffsetOfBytes, null, fileOffsetOfBytes)
    const all = seedRing.toArray()
    const keep = all.length > seedLineTarget ? all.slice(all.length - seedLineTarget) : all
    ring.clear()
    ring.pushMany(keep)
    for (const line of keep) {
      if (line.kind === 'json') {
        seenJson = true
        break
      }
    }
    offset = info.size
    carry = seeded.carry
    carryFileOffset = seeded.carryFileOffset
    recordIngest(keep.length)
  }

  async function pollTick(): Promise<void> {
    if (!running || tickInFlight) {
      return
    }
    tickInFlight = true
    try {
      const info = await readIdentity()
      const prev = identity
      identity = info

      if (prev != null) {
        const inoChanged = prev.ino != null && info.ino != null && prev.ino !== info.ino
        const shrunk = info.size < offset
        if (inoChanged || shrunk) {
          applyRotation()
        }
      }

      if (info.size > offset) {
        const length = info.size - offset
        const chunk = await readRange(offset, length)
        const result = appendTailChunk(ring, chunk, offset, carry, carryFileOffset)
        carry = result.carry
        carryFileOffset = result.carryFileOffset
        offset = info.size
        noteLines(result.linesAdded)
      }

      error = null
      emit()
    } catch (err) {
      error = errorMessageText(err)
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
          await seedFromEnd()
          seeded = true
          emit()
        } catch (err) {
          error = errorMessageText(err)
          emit()
        }
      }
      timer = setInterval(() => {
        void pollTick()
      }, pollIntervalMs)
      timer.unref()
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
        path,
        lines: ring.toArray(),
        stats: buildStats(),
        offset,
        running,
        error,
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
