import { isRecord } from '../lib/is-record'
import {
  parseLogFile,
  readLineAt,
  scanBytes,
  scanBuffer,
  scanHotFields,
  parseIsoTimestampBytes,
  DEFAULT_BATCH_SIZE,
  DEFAULT_CHUNK_SIZE,
  type ParseBatch,
  type ParseLogFileOptions,
  type ParseProgress,
} from './scanner'
import {
  DEFAULT_LOG_TAIL_LINES,
  LOG_TAIL_LINE_PRESETS,
  MAX_LOG_TAIL_LINES,
  MIN_LOG_TAIL_LINES,
  clampLogTailLines,
  formatLogTailPreset,
  nextLogTailPreset,
  parseLogFileTail,
  parseLogTailLinesInput,
  type LogTailLinePreset,
  type ParseLogFileTailOptions,
} from './parse-tail'
import {
  getEntry,
  LogStore,
  encodeSeverity,
  severityLabel,
  SEVERITY_RAW,
  SEVERITY_UNKNOWN,
  KIND_JSON,
  KIND_RAW,
  type LogEntry,
  type LogEntryDetail,
  type LogKind,
  type MemoryEstimate,
  type SeverityCode,
} from './store'

export type {
  ParseBatch,
  ParseLogFileOptions,
  ParseProgress,
  ParseLogFileTailOptions,
  LogTailLinePreset,
  LogEntry,
  LogEntryDetail,
  LogKind,
  MemoryEstimate,
  SeverityCode,
}

export {
  parseLogFile,
  parseLogFileTail,
  DEFAULT_LOG_TAIL_LINES,
  LOG_TAIL_LINE_PRESETS,
  MAX_LOG_TAIL_LINES,
  MIN_LOG_TAIL_LINES,
  clampLogTailLines,
  formatLogTailPreset,
  nextLogTailPreset,
  parseLogTailLinesInput,
  scanBytes,
  scanBuffer,
  scanHotFields,
  parseIsoTimestampBytes,
  getEntry,
  LogStore,
  encodeSeverity,
  severityLabel,
  SEVERITY_RAW,
  SEVERITY_UNKNOWN,
  KIND_JSON,
  KIND_RAW,
  DEFAULT_BATCH_SIZE,
  DEFAULT_CHUNK_SIZE,
}

/**
 * Lazily decode and JSON.parse a single row's full payload for the detail view.
 */
export async function readEntryDetail(store: LogStore, row: number): Promise<LogEntryDetail> {
  const entry = store.getEntry(row)
  const text = await readLineAt(store.path, entry.offset, entry.length)

  if (entry.kind === 'raw') {
    return { ...entry, raw: text }
  }

  try {
    const parsed: unknown = JSON.parse(text)
    if (!isRecord(parsed)) {
      return { ...entry, kind: 'raw', raw: text }
    }
    return { ...entry, attr: parsed.attr, raw: parsed }
  } catch {
    return { ...entry, kind: 'raw', raw: text }
  }
}
