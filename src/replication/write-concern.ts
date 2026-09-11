import type { WriteConcernView } from './types'

/**
 * Normalize getDefaultRWConcern (or serverStatus.defaultRWConcern) into a display view.
 * Does not invent a majority-specific wait metric — that is not cleanly available read-only.
 */
export function normalizeWriteConcern(raw: unknown): WriteConcernView {
  if (raw == null || typeof raw !== 'object') {
    return { defaultW: null, source: null }
  }

  const record = raw as {
    defaultWriteConcern?: { w?: unknown } | null
    defaultWriteConcernSource?: unknown
  }

  const w = record.defaultWriteConcern?.w
  let defaultW: string | null = null
  if (typeof w === 'string' && w.trim() !== '') {
    defaultW = w.trim()
  } else if (typeof w === 'number' && Number.isFinite(w)) {
    defaultW = String(w)
  } else if (typeof w === 'bigint') {
    defaultW = w.toString()
  }

  const source =
    typeof record.defaultWriteConcernSource === 'string'
      ? record.defaultWriteConcernSource
      : null

  return { defaultW, source }
}

export function formatDefaultWriteConcern(view: WriteConcernView | null): string {
  if (view == null || view.defaultW == null) {
    return 'implicit'
  }
  return view.defaultW
}
