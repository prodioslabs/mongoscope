import {
  parseLogFile,
  readLineAt,
  scanBytes,
  scanHotFields,
  parseIsoTimestampBytes,
  DEFAULT_BATCH_SIZE,
  DEFAULT_CHUNK_SIZE,
  type ParseBatch,
  type ParseLogFileOptions,
} from './scanner'
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
  LogEntry,
  LogEntryDetail,
  LogKind,
  MemoryEstimate,
  SeverityCode,
}

export {
  parseLogFile,
  scanBytes,
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
export async function readEntryDetail(
  store: LogStore,
  row: number,
): Promise<LogEntryDetail> {
  const entry = store.getEntry(row)
  const text = await readLineAt(store.path, entry.offset, entry.length)

  if (entry.kind === 'raw') {
    return { ...entry, raw: text }
  }

  try {
    const parsed: unknown = JSON.parse(text)
    const attr =
      parsed !== null &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      'attr' in parsed
        ? (parsed as { attr?: unknown }).attr
        : undefined
    return { ...entry, attr, raw: parsed }
  } catch {
    return { ...entry, kind: 'raw', raw: text }
  }
}
