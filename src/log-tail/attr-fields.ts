/**
 * Optional structured fields from a MongoDB log `attr` object.
 * Unlike extractSlowQueryAttr, missing `ns` is allowed.
 */
export type LogLineAttrFields = {
  namespace: string | null
  durationMillis: number | null
  planSummary: string | null
}

export function extractLogLineAttrFields(attr: unknown): LogLineAttrFields {
  if (attr === null || typeof attr !== 'object' || Array.isArray(attr)) {
    return { namespace: null, durationMillis: null, planSummary: null }
  }
  const record = attr as Record<string, unknown>

  const namespace = typeof record.ns === 'string' && record.ns.length > 0 ? record.ns : null

  let durationMillis: number | null = null
  if (typeof record.durationMillis === 'number' && Number.isFinite(record.durationMillis)) {
    durationMillis = record.durationMillis
  }

  const planSummary =
    typeof record.planSummary === 'string' && record.planSummary.length > 0
      ? record.planSummary
      : null

  return { namespace, durationMillis, planSummary }
}
