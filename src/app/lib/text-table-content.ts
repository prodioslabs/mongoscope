import { bg, bold, fg, type RGBA, type TextChunk, type TextTableContent } from '@opentui/core'
import { type Theme } from '../theme'

export type Severity = 'error' | 'warning' | 'success' | 'muted'

/** Approximate height of one data row (content line + inner border). */
const TABLE_ROW_STRIDE = 2

export function computeTableCapacity(chromeRows: number, terminalHeight: number): number {
  return Math.max(1, Math.floor((terminalHeight - chromeRows) / TABLE_ROW_STRIDE))
}

export function headerCell(label: string, theme: Theme): TextChunk[] {
  return [bold(fg(theme.textMuted)(label))]
}

export function tableCell(text: string, color: RGBA, background?: RGBA): TextChunk[] {
  const colored = fg(color)(text)
  if (background) {
    return [bg(background)(colored)]
  }
  return [colored]
}

export function severityColor(theme: Theme, severity: Severity): RGBA {
  switch (severity) {
    case 'error':
      return theme.error
    case 'warning':
      return theme.warning
    case 'success':
      return theme.success
    case 'muted':
      return theme.textMuted
  }
}

export function emptyTableRow(columnCount: number): TextChunk[][] {
  return Array.from({ length: columnCount }, () => [])
}

/** Pad data rows (excluding header) to fill the visible table capacity. */
export function padTableRows(rows: TextTableContent, rowCapacity: number): TextTableContent {
  const padded = [...rows]
  while (padded.length - 1 < rowCapacity) {
    if (padded.length === 0) {
      break
    }
    const columnCount = padded[0]?.length ?? 0
    padded.push(emptyTableRow(columnCount))
  }
  return padded
}
