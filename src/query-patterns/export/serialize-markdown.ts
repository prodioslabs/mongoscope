import type { ExportableQueryDetail, SlowQueriesExportDocument } from './types'

/**
 * Markdown export: summary table of pattern aggregates, then one query-detail
 * section per pattern (same fields as the detail dialog default view).
 */
export function serializeSlowQueriesMarkdown(document: SlowQueriesExportDocument): string {
  const { metadata, patterns } = document
  const lines: string[] = [
    '# Slow query patterns',
    '',
    `- source: ${metadata.source}`,
    `- exported: ${metadata.exportedAt}`,
    `- patterns: ${metadata.patternCount}`,
  ]
  if (metadata.label != null && metadata.label !== '') {
    lines.push(`- label: ${escapeInline(metadata.label)}`)
  }
  lines.push(`- window: ${metadata.windowStartMs}–${metadata.windowEndMs}`)
  if (metadata.sampleLimit != null) {
    lines.push(`- sample limit: ${metadata.sampleLimit}`)
  }
  lines.push(`- sort: ${metadata.sort.by} ${metadata.sort.direction}`, '')

  lines.push(
    '| namespace | op | shape | count | avgMs | examined | returned | plan | totalMs |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  )
  for (const pattern of patterns) {
    lines.push(
      `| ${escapeCell(pattern.namespace)} | ${escapeCell(pattern.op)} | ${escapeCell(pattern.shape)} | ${pattern.count} | ${pattern.avgMs} | ${pattern.avgDocsExamined} | ${pattern.avgDocsReturned} | ${escapeCell(pattern.plan)} | ${pattern.totalDurationMs} |`,
    )
  }

  if (patterns.length > 0) {
    lines.push('', '## Query detail')
    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i]!
      lines.push('', `### ${i + 1}. ${escapeInline(pattern.namespace)} · ${escapeInline(pattern.op)}`)
      lines.push(`- shape: ${escapeInline(pattern.shape)}`)
      lines.push(`- count: ${pattern.count} · avgMs: ${pattern.avgMs} · totalMs: ${pattern.totalDurationMs}`)
      if (pattern.detail == null) {
        lines.push('- detail: unavailable')
        continue
      }
      lines.push(...formatDetailMarkdown(pattern.detail))
    }
  }

  return `${lines.join('\n')}\n`
}

function formatDetailMarkdown(detail: ExportableQueryDetail): string[] {
  const lines: string[] = [
    `- sample duration: ${detail.totalMillis} ms`,
    `- sample examined/returned: ${detail.docsExamined} / ${detail.nReturned}`,
    `- stage: ${escapeInline(detail.stageDetail)}`,
  ]
  if (detail.planSummary != null && detail.planSummary !== '') {
    lines.push(`- plan summary: ${escapeInline(detail.planSummary)}`)
  }
  lines.push('', 'Filter / pipeline', '', '```', detail.filter, '```')
  if (detail.suggestedIndexCommand != null) {
    lines.push('', 'Suggested index', '', '```', detail.suggestedIndexCommand, '```')
    if (detail.suggestedIndexReason != null) {
      lines.push(escapeInline(detail.suggestedIndexReason))
    }
  }
  lines.push('', 'Context')
  lines.push(`- timestamp: ${detail.timestamp ?? 'n/a'}`)
  lines.push(`- ctx: ${escapeInline(detail.ctx || 'n/a')}`)
  lines.push(`- app: ${escapeInline(detail.appName ?? 'n/a')}`)
  lines.push(`- remote: ${escapeInline(detail.remote ?? 'n/a')}`)
  lines.push(`- protocol: ${escapeInline(detail.protocol ?? 'n/a')}`)

  const work: string[] = []
  if (detail.keysExamined != null) {
    work.push(`keysExamined: ${detail.keysExamined}`)
  }
  if (detail.numYields != null) {
    work.push(`yields: ${detail.numYields}`)
  }
  if (detail.reslen != null) {
    work.push(`reslen: ${detail.reslen}`)
  }
  if (detail.cpuNanos != null) {
    work.push(`cpuNanos: ${detail.cpuNanos}`)
  }
  if (detail.workingMillis != null) {
    work.push(`workingMs: ${detail.workingMillis}`)
  }
  if (detail.waitForWriteConcernDurationMillis != null) {
    work.push(`wcWaitMs: ${detail.waitForWriteConcernDurationMillis}`)
  }
  if (work.length > 0) {
    lines.push('', `Work: ${work.join(' · ')}`)
  }

  lines.push('', 'Command', '', '```', detail.command, '```')
  return lines
}

function escapeCell(value: string): string {
  const singleLine = value
    .replaceAll('|', '\\|')
    .replaceAll('\r\n', ' ')
    .replaceAll('\n', ' ')
    .replaceAll('\r', ' ')
  if (singleLine.length <= 80) {
    return singleLine
  }
  return `${singleLine.slice(0, 79)}…`
}

function escapeInline(value: string): string {
  return value.replaceAll('\n', ' ').replaceAll('\r', ' ')
}
