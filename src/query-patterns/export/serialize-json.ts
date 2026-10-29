import type { SlowQueriesExportDocument } from './types'

export function serializeSlowQueriesJson(document: SlowQueriesExportDocument): string {
  return `${JSON.stringify(document, null, 2)}\n`
}
