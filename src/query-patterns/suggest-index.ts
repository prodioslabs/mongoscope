import { splitNamespace } from './attr'
import type { IndexSuggestion } from './types'

type SuggestIndexInput = {
  namespace: string
  plan: string
  equalityFields: string[]
  docsExamined: number
  nReturned: number
}

/**
 * Suggest an ESR equality-only index when the plan is a collection scan
 * and the filter has equality fields.
 */
export function suggestIndex(input: SuggestIndexInput): IndexSuggestion | null {
  if (input.plan !== 'COLLSCAN') return null
  if (input.equalityFields.length === 0) return null

  const { collection } = splitNamespace(input.namespace)
  const keys = input.equalityFields.map((f) => `${f}: 1`).join(', ')
  const command = `db.${collection}.createIndex({ ${keys} })`

  const estimatedExamined = Math.max(1, input.nReturned)
  const reduction =
    input.docsExamined > 0
      ? ((input.docsExamined - estimatedExamined) / input.docsExamined) * 100
      : 0
  // Cap below 100 so near-total reductions read as 99.9% (matches typical UX)
  const reductionLabel = Math.min(99.9, Math.floor(reduction * 10) / 10).toFixed(1)

  const reason = `ESR rule · equality fields only · est. docsExamined -> ~${formatCount(estimatedExamined)} (-${reductionLabel}%)`

  return { command, reason, estimatedExamined }
}

function formatCount(n: number): string {
  return Math.round(n).toLocaleString('en-US')
}
