import type { IndexMarker, PlanTransition, WindowComparison } from './types'

export function formatHistoryTimestamp(timestampMs: number): string {
  if (!Number.isFinite(timestampMs)) {
    return 'n/a'
  }
  return new Date(timestampMs).toISOString()
}

export function formatPlanTransition(transition: PlanTransition): string {
  const at = formatHistoryTimestamp(transition.atMs)
  return `${transition.fromPlan} → ${transition.toPlan} · ${at}`
}

export function formatIndexMarker(marker: IndexMarker): string {
  const at = formatHistoryTimestamp(marker.timestampMs)
  const prefix =
    marker.kind === 'drop-indexes'
      ? 'idx-'
      : marker.kind === 'create-indexes' || marker.kind === 'index-build-start'
        ? 'idx+'
        : 'idx='
  return `${prefix} ${marker.label} · ${at}`
}

export function formatWindowSummary(label: string, comparison: WindowComparison): string {
  const side = label === 'early' ? comparison.early : comparison.late
  const plan = side.plan
  return `${label}: n=${side.count} avg=${side.avgMs}ms plan=${plan}`
}
