import { serializeSlowQueriesCsv } from './serialize-csv'
import { serializeSlowQueriesJson } from './serialize-json'
import { serializeSlowQueriesMarkdown } from './serialize-markdown'
import type { ExportFormat, SlowQueriesExportDocument } from './types'

export function serializeSlowQueriesExport(
  document: SlowQueriesExportDocument,
  format: ExportFormat,
): string {
  if (format === 'json') {
    return serializeSlowQueriesJson(document)
  }
  if (format === 'csv') {
    return serializeSlowQueriesCsv(document)
  }
  return serializeSlowQueriesMarkdown(document)
}
