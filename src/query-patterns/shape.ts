/**
 * Normalize a MongoDB filter / query document into a stable shape string.
 * Primitive values become `1`; operators and structure are preserved; keys sorted.
 *
 * Example: `{ status: "pending", district: "dehradun" }` → `{status:1, district:1}`
 */
export function shapeOfFilter(value: unknown): string {
  return formatShape(normalizeValue(value))
}

/**
 * Compact an aggregation pipeline into stage labels.
 * `$lookup` includes the `from` collection when present.
 */
export function shapeOfPipeline(pipeline: unknown): string {
  if (!Array.isArray(pipeline) || pipeline.length === 0) return 'n/a'

  const parts: string[] = []
  for (const stage of pipeline) {
    if (stage === null || typeof stage !== 'object' || Array.isArray(stage)) {
      parts.push('?')
      continue
    }
    const keys = Object.keys(stage as Record<string, unknown>)
    const op = keys[0]
    if (op == null) {
      parts.push('?')
      continue
    }
    if (op === '$lookup') {
      const lookup = (stage as Record<string, unknown>)[op]
      const from =
        lookup !== null && typeof lookup === 'object' && !Array.isArray(lookup)
          ? (lookup as Record<string, unknown>).from
          : undefined
      parts.push(typeof from === 'string' ? `$lookup -> ${from}` : '$lookup')
    } else {
      parts.push(op)
    }
  }
  return parts.join(' → ')
}

function normalizeValue(value: unknown): unknown {
  if (value === null || value === undefined) return 1
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return 1
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return []
    // Homogeneous primitives → [1]; otherwise normalize each element
    const allPrimitive = value.every(
      (v) => v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean',
    )
    if (allPrimitive) return [1]
    return value.map(normalizeValue)
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const keys = Object.keys(obj)
    // BSON / extended JSON wrappers ($oid, $date, $numberLong, …) → 1
    if (keys.length === 1 && isBsonWrapperKey(keys[0]!)) {
      return 1
    }
    const out: Record<string, unknown> = {}
    for (const key of keys.sort()) {
      out[key] = normalizeValue(obj[key])
    }
    return out
  }
  return 1
}

const BSON_WRAPPER_KEYS = new Set([
  '$oid',
  '$date',
  '$numberLong',
  '$numberInt',
  '$numberDouble',
  '$numberDecimal',
  '$timestamp',
  '$binary',
  '$regularExpression',
  '$symbol',
  '$code',
  '$codeWithScope',
  '$minKey',
  '$maxKey',
  '$undefined',
])

function isBsonWrapperKey(key: string): boolean {
  return BSON_WRAPPER_KEYS.has(key)
}

function formatShape(value: unknown): string {
  if (value === null || value === undefined) return '1'
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    return `[${value.map(formatShape).join(', ')}]`
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const keys = Object.keys(obj)
    if (keys.length === 0) return '{}'
    const body = keys.map((k) => `${k}:${formatShape(obj[k])}`).join(', ')
    return `{${body}}`
  }
  return '1'
}

/**
 * Collect top-level equality field names from a filter (skip `$`-operator keys
 * and fields whose value is an operator object like `{ $gt: … }`).
 */
export function equalityFieldsOfFilter(value: unknown): string[] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return []
  const fields: string[] = []
  const obj = value as Record<string, unknown>
  for (const key of Object.keys(obj)) {
    if (key.startsWith('$')) continue
    const v = obj[key]
    if (isOperatorObject(v)) continue
    fields.push(key)
  }
  return fields
}

function isOperatorObject(value: unknown): boolean {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const keys = Object.keys(value as Record<string, unknown>)
  return keys.length > 0 && keys.every((k) => k.startsWith('$'))
}
