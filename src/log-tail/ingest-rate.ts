import type { LogTailFormat, LogTailStats } from './types'

const RATE_WINDOW_MS = 1000

export type IngestRateTracker = {
  recordIngest(count: number): void
  linesPerSec(): number
}

/** Sliding 1s window of ingest timestamps used by file and getLog tailers. */
export function createIngestRateTracker(now: () => number): IngestRateTracker {
  const ingestTimestamps: number[] = []

  function recordIngest(count: number): void {
    if (count <= 0) {
      return
    }
    const t = now()
    for (let i = 0; i < count; i++) {
      ingestTimestamps.push(t)
    }
    const cutoff = t - RATE_WINDOW_MS
    while (ingestTimestamps.length > 0 && ingestTimestamps[0]! < cutoff) {
      ingestTimestamps.shift()
    }
  }

  function linesPerSec(): number {
    const t = now()
    const cutoff = t - RATE_WINDOW_MS
    let count = 0
    for (let i = ingestTimestamps.length - 1; i >= 0; i--) {
      if (ingestTimestamps[i]! < cutoff) {
        break
      }
      count++
    }
    return count
  }

  return { recordIngest, linesPerSec }
}

function logTailFormatLabel(seenJson: boolean): LogTailFormat {
  return seenJson ? 'JSON (4.4+)' : 'raw/legacy'
}

export function buildLogTailStats(input: {
  seenJson: boolean
  linesPerSec: number
  restartsDetected: number
  bufferedCount: number
}): LogTailStats {
  return {
    format: logTailFormatLabel(input.seenJson),
    linesPerSec: input.linesPerSec,
    restartsDetected: input.restartsDetected,
    bufferedCount: input.bufferedCount,
  }
}
