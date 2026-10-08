import type { QueryPattern } from '../types'
import type { ExportablePattern } from './types'

export function toExportablePattern(pattern: QueryPattern): ExportablePattern {
  return {
    namespace: pattern.namespace,
    op: pattern.op,
    shape: pattern.shape,
    count: pattern.count,
    avgMs: pattern.avgMs,
    avgDocsExamined: pattern.avgDocsExamined,
    avgDocsReturned: pattern.avgDocsReturned,
    plan: pattern.plan,
    totalDurationMs: pattern.totalDurationMs,
    trend: Array.from(pattern.trend),
  }
}

export function toExportablePatterns(patterns: readonly QueryPattern[]): ExportablePattern[] {
  return patterns.map(toExportablePattern)
}
