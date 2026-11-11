import { avgMsPerBucket } from './bucket'
import { compareHistoryWindows } from './compare'
import {
  formatHistoryTimestamp,
  formatIndexMarker,
  formatPlanTransition,
  formatWindowSummary,
} from './format'
import { filterMarkersForNamespace } from './index-markers'
import { detectPlanTransitions } from './plan-transitions'
import { scoreFromComparison } from './regression'
import { REGRESSION_MIN_SAMPLES, type IndexMarker, type PatternHistory } from './types'

const HISTORY_LIVE_UNAVAILABLE_NOTICE =
  'Query Time Machine is static log analysis only. Live system.profile has no durable history. Nothing is stored — open a mongod.log to compare early vs late in that file.'

const HISTORY_STATIC_DISCLAIMER =
  'First seen slow in this log tail (ops above slowms only — not a true baseline). Same-period changes are correlation, not causation. Session-only; MongoScope does not store history.'

type HistoryDetailPattern = {
  namespace: string
  trend: ArrayLike<number>
  history: PatternHistory | null
}

export type PatternHistoryDetail =
  | {
      kind: 'unavailable'
      notice: string
    }
  | {
      kind: 'available'
      disclaimer: string
      firstSlow: string
      lastSlow: string
      avgMsTrend: Float64Array
      volumeTrend: ArrayLike<number>
      earlySummary: string
      lateSummary: string
      regressionLabel: string
      regressionScore: number
      lowConfidence: boolean
      planMixLabel: string | null
      planTransitionLines: string[]
      indexMarkerLines: string[]
    }

/** Shared History fields for the detail dialog and clipboard copy. */
export function buildHistoryDetail(
  pattern: HistoryDetailPattern,
  indexMarkers: readonly IndexMarker[],
): PatternHistoryDetail {
  if (pattern.history == null) {
    return {
      kind: 'unavailable',
      notice: HISTORY_LIVE_UNAVAILABLE_NOTICE,
    }
  }

  const history = pattern.history
  const comparison = compareHistoryWindows(history, pattern.trend)
  const regression = scoreFromComparison(comparison)
  const transitions = detectPlanTransitions(history)
  const markers = filterMarkersForNamespace(indexMarkers, pattern.namespace).filter(
    function inPatternSpan(marker) {
      return (
        marker.timestampMs >= history.firstSeenSlowMs &&
        marker.timestampMs <= history.lastSeenSlowMs
      )
    },
  )

  return {
    kind: 'available',
    disclaimer: HISTORY_STATIC_DISCLAIMER,
    firstSlow: formatHistoryTimestamp(history.firstSeenSlowMs),
    lastSlow: formatHistoryTimestamp(history.lastSeenSlowMs),
    avgMsTrend: avgMsPerBucket(pattern.trend, history.sumDurationMs),
    volumeTrend: pattern.trend,
    earlySummary: formatWindowSummary('early', comparison),
    lateSummary: formatWindowSummary('late', comparison),
    regressionLabel: comparison.lowConfidence
      ? `low confidence (need ≥${REGRESSION_MIN_SAMPLES} samples/window) · score ${regression.score.toFixed(2)}`
      : `score ${regression.score.toFixed(2)}`,
    regressionScore: regression.score,
    lowConfidence: comparison.lowConfidence,
    planMixLabel:
      history.planMix.length > 0
        ? history.planMix.map((entry) => `${entry.plan}×${entry.count}`).join(' · ')
        : null,
    planTransitionLines: transitions.map(formatPlanTransition),
    indexMarkerLines: markers.map(formatIndexMarker),
  }
}
