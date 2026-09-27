import { open, stat } from 'node:fs/promises'
import { flushCarry, scanBuffer } from './scanner'
import { LogStore } from './store'

/** Rough average bytes per mongod JSON log line for EOF window sizing. */
const AVG_BYTES_PER_LINE = 256
/** Cap a single read attempt so huge presets do not allocate unbounded buffers. */
export const MAX_READ_BYTES = 128 * 1024 * 1024

export type ParseLogFileTailOptions = {
  maxLines: number
  onProgress?: (progress: { bytesRead: number; rowCount: number }) => void
  /**
   * Path recorded on the {@link LogStore} (defaults to the path being read).
   * Use when reading a temp copy but displaying/tracking the original log path.
   */
  storePath?: string
}

export const LOG_TAIL_LINE_PRESETS = [10_000, 25_000, 50_000, 100_000, 250_000] as const
export type LogTailLinePreset = (typeof LOG_TAIL_LINE_PRESETS)[number]
export const DEFAULT_LOG_TAIL_LINES: LogTailLinePreset = 100_000
export const MIN_LOG_TAIL_LINES = 1
export const MAX_LOG_TAIL_LINES = 1_000_000

/**
 * Index only the last `maxLines` lines of a log file (EOF-relative).
 * Suitable for large staging/prod logs where a full-file scan is too costly.
 */
export async function parseLogFileTail(
  path: string,
  options: ParseLogFileTailOptions,
): Promise<LogStore> {
  const maxLines = Math.max(0, Math.floor(options.maxLines))
  const onProgress = options.onProgress
  const storePath = options.storePath ?? path
  const info = await stat(path)
  const size = info.size

  if (maxLines === 0 || size === 0) {
    const empty = new LogStore(storePath)
    empty.byteLength = size
    onProgress?.({ bytesRead: size, rowCount: 0 })
    return empty
  }

  let windowBytes = Math.min(size, Math.max(maxLines * AVG_BYTES_PER_LINE, 64 * 1024))
  windowBytes = Math.min(windowBytes, MAX_READ_BYTES)

  // Expand once if the first window under-delivers (long lines / sparse newlines).
  for (let attempt = 0; attempt < 2; attempt++) {
    const store = await readTailWindow(path, size, windowBytes, storePath, onProgress)
    if (store.rowCount >= maxLines || windowBytes >= size) {
      store.retainTail(maxLines)
      onProgress?.({ bytesRead: size, rowCount: store.rowCount })
      return store
    }
    windowBytes = Math.min(size, Math.min(MAX_READ_BYTES, windowBytes * 2))
  }

  const store = await readTailWindow(
    path,
    size,
    Math.min(size, MAX_READ_BYTES),
    storePath,
    onProgress,
  )
  store.retainTail(maxLines)
  onProgress?.({ bytesRead: size, rowCount: store.rowCount })
  return store
}

async function readTailWindow(
  path: string,
  fileSize: number,
  windowBytes: number,
  storePath: string,
  onProgress?: (progress: { bytesRead: number; rowCount: number }) => void,
): Promise<LogStore> {
  const store = new LogStore(storePath)
  const start = Math.max(0, fileSize - windowBytes)
  const length = fileSize - start
  if (length <= 0) {
    store.byteLength = fileSize
    return store
  }

  const fh = await open(path, 'r')
  try {
    const buf = Buffer.allocUnsafe(length)
    const { bytesRead } = await fh.read(buf, 0, length, start)
    let bytes: Uint8Array = Uint8Array.from(buf.subarray(0, bytesRead))
    let fileOffsetOfBytes = start

    if (start > 0) {
      const skipped = skipPartialLeadingLine(bytes)
      fileOffsetOfBytes = start + skipped.skipped
      bytes = skipped.bytes
    }

    let carry: Uint8Array | null = null
    let carryFileOffset = fileOffsetOfBytes
    const chunkSize = 4 * 1024 * 1024
    let offset = 0
    while (offset < bytes.length) {
      const end = Math.min(offset + chunkSize, bytes.length)
      const chunk = bytes.subarray(offset, end)
      const result = scanBuffer(store, chunk, fileOffsetOfBytes + offset, carry, carryFileOffset)
      carry = result.carry
      carryFileOffset = result.carryFileOffset
      offset = end
      onProgress?.({
        bytesRead: fileOffsetOfBytes + offset,
        rowCount: store.rowCount,
      })
    }
    flushCarry(store, carry, carryFileOffset)
    store.byteLength = fileSize
    return store
  } finally {
    await fh.close()
  }
}

function skipPartialLeadingLine(buf: Uint8Array): { bytes: Uint8Array; skipped: number } {
  const CHAR_LF = 0x0a
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] === CHAR_LF) {
      return { bytes: buf.subarray(i + 1), skipped: i + 1 }
    }
  }
  return { bytes: new Uint8Array(0), skipped: buf.length }
}

export function nextLogTailPreset(current: number): LogTailLinePreset {
  const index = LOG_TAIL_LINE_PRESETS.indexOf(current as LogTailLinePreset)
  if (index < 0) {
    return DEFAULT_LOG_TAIL_LINES
  }
  return LOG_TAIL_LINE_PRESETS[(index + 1) % LOG_TAIL_LINE_PRESETS.length]!
}

export function formatLogTailPreset(lines: number): string {
  if (lines >= 1000 && lines % 1000 === 0) {
    return `${lines / 1000}k`
  }
  if (lines >= 1000) {
    return `${Math.round(lines / 1000)}k`
  }
  return String(lines)
}

/** Parse a custom tail size from dialog input (digits, optional `k` / `K` suffix). */
export function parseLogTailLinesInput(text: string): number | null {
  const trimmed = text.trim().replace(/,/g, '').toLowerCase()
  if (trimmed.length === 0) {
    return null
  }

  let value: number
  if (/^\d+k$/.test(trimmed)) {
    value = Number(trimmed.slice(0, -1)) * 1000
  } else if (/^\d+$/.test(trimmed)) {
    value = Number(trimmed)
  } else {
    return null
  }

  if (!Number.isFinite(value) || value < MIN_LOG_TAIL_LINES || value > MAX_LOG_TAIL_LINES) {
    return null
  }
  return Math.floor(value)
}

export function clampLogTailLines(lines: number): number {
  if (!Number.isFinite(lines)) {
    return DEFAULT_LOG_TAIL_LINES
  }
  return Math.min(MAX_LOG_TAIL_LINES, Math.max(MIN_LOG_TAIL_LINES, Math.floor(lines)))
}
