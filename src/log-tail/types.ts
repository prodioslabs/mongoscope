import type { SeverityCode } from '../parser'

/** MongoDB structured-log components exposed as Logs category pills. */
export const LOG_CATEGORY_COMPONENTS = [
  'COMMAND',
  'WRITE',
  'REPL',
  'NETWORK',
  'STORAGE',
] as const

export type LogCategoryComponent = (typeof LOG_CATEGORY_COMPONENTS)[number]

export const DEFAULT_ENABLED_CATEGORIES: ReadonlySet<LogCategoryComponent> = new Set(
  LOG_CATEGORY_COMPONENTS,
)

export const LOG_TAIL_RING_CAPACITY = 3000
export const LOG_TAIL_POLL_INTERVAL_MS = 100
export const LOG_TAIL_UI_COALESCE_MS = 150
/** Approximate bytes to read from EOF when seeding (~2000 lines). */
export const LOG_TAIL_SEED_BYTE_WINDOW = 1_048_576
export const LOG_TAIL_SEED_LINE_TARGET = 2000

export type TailLogLine = {
  timestamp: number
  severity: SeverityCode
  severityLabel: string
  component: string
  id: number
  ctx: string
  msg: string
  namespace: string | null
  durationMillis: number | null
  planSummary: string | null
  kind: 'json' | 'raw'
}

export type LogTailFormat = 'JSON (4.4+)' | 'raw/legacy'

export type LogTailStats = {
  format: LogTailFormat
  linesPerSec: number
  restartsDetected: number
  bufferedCount: number
}

export type CustomFilterField =
  | 'durationMillis'
  | 'namespace'
  | 'planSummary'
  | 'msg'
  | 'component'

export type CustomFilterOperator = '>' | '<' | '>=' | '<=' | '=' | 'contains'

export type CustomFilterExpression = {
  field: CustomFilterField
  operator: CustomFilterOperator
  value: string
  /** Parsed number when field is durationMillis and value is numeric. */
  numericValue: number | null
}

export type CustomFilterParseResult =
  | { ok: true; expression: CustomFilterExpression }
  | { ok: false; error: string }
