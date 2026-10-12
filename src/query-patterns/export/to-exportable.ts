import type { PatternExplain, QueryPattern } from '../types'
import type { ExportablePattern, ExportableQueryDetail } from './types'

export function toExportablePattern(
  pattern: QueryPattern,
  explain: PatternExplain | null,
): ExportablePattern {
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
    detail: explain != null ? toExportableQueryDetail(explain) : null,
  }
}

export function toExportablePatterns(
  entries: ReadonlyArray<{ pattern: QueryPattern; explain: PatternExplain | null }>,
): ExportablePattern[] {
  return entries.map(function mapEntry(entry) {
    return toExportablePattern(entry.pattern, entry.explain)
  })
}

export function toExportableQueryDetail(explain: PatternExplain): ExportableQueryDetail {
  return {
    planSummary: explain.planSummary,
    filter: explain.filter,
    docsExamined: explain.docsExamined,
    nReturned: explain.nReturned,
    totalMillis: explain.totalMillis,
    stageDetail: explain.stageDetail,
    suggestedIndexCommand: explain.suggestedIndex?.command ?? null,
    suggestedIndexReason: explain.suggestedIndex?.reason ?? null,
    timestamp: formatDetailTimestamp(explain.timestampMs),
    ctx: explain.ctx,
    appName: explain.appName,
    remote: explain.remote,
    protocol: explain.protocol,
    keysExamined: explain.keysExamined,
    numYields: explain.numYields,
    reslen: explain.reslen,
    cpuNanos: explain.cpuNanos,
    workingMillis: explain.workingMillis,
    waitForWriteConcernDurationMillis: explain.waitForWriteConcernDurationMillis,
    command: explain.commandDisplay,
  }
}

function formatDetailTimestamp(timestampMs: number): string | null {
  if (!Number.isFinite(timestampMs)) {
    return null
  }
  return new Date(timestampMs).toISOString()
}
