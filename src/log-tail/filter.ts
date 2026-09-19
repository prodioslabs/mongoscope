import type { TailLogLine } from './types'
import {
  type CustomFilterExpression,
  type CustomFilterField,
  type CustomFilterOperator,
  type CustomFilterParseResult,
  type LogCategoryComponent,
  LOG_CATEGORY_COMPONENTS,
} from './types'

const FIELD_SET = new Set<string>([
  'durationMillis',
  'namespace',
  'planSummary',
  'msg',
  'component',
])

const NUMERIC_OPS = new Set<CustomFilterOperator>(['>', '<', '>=', '<='])

/**
 * Parse `field operator value` (e.g. `durationMillis>100`, `namespace contains apps`).
 */
export function parseCustomFilterExpression(input: string): CustomFilterParseResult {
  const trimmed = input.trim()
  if (trimmed.length === 0) {
    return { ok: false, error: 'empty filter expression' }
  }

  const match = trimmed.match(
    /^(durationMillis|namespace|planSummary|msg|component)\s*(>=|<=|>|<|=|contains)\s*(.+)$/i,
  )
  if (match == null) {
    return {
      ok: false,
      error: 'expected: field operator value (e.g. durationMillis>100)',
    }
  }

  const fieldRaw = match[1]!.toLowerCase()
  const field = normalizeField(fieldRaw)
  if (field == null || !FIELD_SET.has(field)) {
    return { ok: false, error: `unknown field "${match[1]}"` }
  }

  const operator = match[2]!.toLowerCase() as CustomFilterOperator
  const value = match[3]!.trim()
  if (value.length === 0) {
    return { ok: false, error: 'missing filter value' }
  }

  if (NUMERIC_OPS.has(operator) && field !== 'durationMillis') {
    return {
      ok: false,
      error: `operator ${operator} is only valid for durationMillis`,
    }
  }

  let numericValue: number | null = null
  if (field === 'durationMillis') {
    if (operator === 'contains') {
      return { ok: false, error: 'contains is not valid for durationMillis' }
    }
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) {
      return { ok: false, error: `durationMillis value must be a number (got "${value}")` }
    }
    numericValue = parsed
  }

  return {
    ok: true,
    expression: { field, operator, value, numericValue },
  }
}

function normalizeField(raw: string): CustomFilterField | null {
  switch (raw) {
    case 'durationmillis':
      return 'durationMillis'
    case 'namespace':
      return 'namespace'
    case 'plansummary':
      return 'planSummary'
    case 'msg':
      return 'msg'
    case 'component':
      return 'component'
    default:
      return null
  }
}

export function evaluateCustomFilter(
  line: TailLogLine,
  expression: CustomFilterExpression,
): boolean {
  switch (expression.field) {
    case 'durationMillis': {
      if (line.durationMillis == null || expression.numericValue == null) {
        return false
      }
      const left = line.durationMillis
      const right = expression.numericValue
      return match(expression.operator, left, right, String(left), expression.value)
    }
    case 'namespace':
      return matchString(expression.operator, line.namespace ?? '', expression.value)
    case 'planSummary':
      return matchString(expression.operator, line.planSummary ?? '', expression.value)
    case 'msg':
      return matchString(expression.operator, line.msg, expression.value)
    case 'component':
      return matchString(expression.operator, line.component, expression.value)
    default:
      return false
  }
}

function matchString(operator: CustomFilterOperator, left: string, right: string): boolean {
  if (NUMERIC_OPS.has(operator)) {
    return false
  }
  return match(operator, 0, 0, left, right)
}

function match(
  operator: CustomFilterOperator,
  leftNum: number,
  rightNum: number,
  leftStr: string,
  rightStr: string,
): boolean {
  switch (operator) {
    case '>':
      return leftNum > rightNum
    case '<':
      return leftNum < rightNum
    case '>=':
      return leftNum >= rightNum
    case '<=':
      return leftNum <= rightNum
    case '=':
      return leftStr === rightStr
    case 'contains':
      return leftStr.toLowerCase().includes(rightStr.toLowerCase())
    default:
      return false
  }
}

export function lineMatchesCategories(
  line: TailLogLine,
  enabled: ReadonlySet<string>,
): boolean {
  if (enabled.size === 0) {
    return true
  }
  return enabled.has(line.component)
}

/** Case-insensitive substring on msg + namespace only. */
export function lineMatchesSearch(line: TailLogLine, needle: string): boolean {
  const trimmed = needle.trim()
  if (trimmed.length === 0) {
    return true
  }
  const lower = trimmed.toLowerCase()
  if (line.msg.toLowerCase().includes(lower)) {
    return true
  }
  if (line.namespace != null && line.namespace.toLowerCase().includes(lower)) {
    return true
  }
  return false
}

export function filterTailLines(
  lines: ReadonlyArray<TailLogLine>,
  options: {
    enabledCategories: ReadonlySet<string>
    customFilter: CustomFilterExpression | null
    search: string
  },
): TailLogLine[] {
  const out: TailLogLine[] = []
  for (const line of lines) {
    if (!lineMatchesCategories(line, options.enabledCategories)) {
      continue
    }
    if (options.customFilter != null && !evaluateCustomFilter(line, options.customFilter)) {
      continue
    }
    if (!lineMatchesSearch(line, options.search)) {
      continue
    }
    out.push(line)
  }
  return out
}

export function isLogCategoryComponent(value: string): value is LogCategoryComponent {
  return (LOG_CATEGORY_COMPONENTS as readonly string[]).includes(value)
}
