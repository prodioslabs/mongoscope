import { type TextChunk, type TextTableContent } from '@opentui/core'
import { useTerminalDimensions } from '@opentui/react'
import {
  formatRunningMs,
  runningMsSeverity,
  truncateLiveOpsCell,
  type CurrentOpRow,
  type LiveOpsPanelError,
} from '../../../../live-ops'
import { displayText } from '../../../../lib/display-text'
import {
  computeTableCapacity,
  headerCell,
  padTableRows,
  severityColor,
  tableCell,
} from '../../../lib/text-table-content'
import { useTheme } from '../../../stores/theme'
import { type Theme } from '../../../theme'
import { DataTextTable } from '../../data-text-table'

type CurrentOpsTableProps = {
  ops: CurrentOpRow[]
  error: LiveOpsPanelError | null
  ownOpsOnly: boolean
  lockNote: string
  /** When true, sidebar stacks below the table — reserve extra vertical chrome. */
  stackedLayout?: boolean
}

/**
 * Non-data lines above/below the currentOp table within Live Ops:
 * tab bar, footer, DbSelector, dashboard header, collection top, borders/padding.
 */
const LIVE_OPS_CHROME_ROWS = 18
const LIVE_OPS_STACKED_CHROME_ROWS = 26

export function CurrentOpsTable({
  ops,
  error,
  ownOpsOnly,
  lockNote,
  stackedLayout = false,
}: CurrentOpsTableProps) {
  const theme = useTheme((s) => s.theme)
  const { height: terminalHeight } = useTerminalDimensions()

  if (error != null) {
    return (
      <box flexGrow={1} flexDirection="column" gap={0}>
        <text content={displayText(error.message)} fg={theme.error} />
      </box>
    )
  }

  const chromeRows = stackedLayout ? LIVE_OPS_STACKED_CHROME_ROWS : LIVE_OPS_CHROME_ROWS
  const capacity = computeTableCapacity(chromeRows, terminalHeight)
  const visible = ops.slice(0, capacity)
  const content = buildCurrentOpTableContent(visible, theme, capacity)
  const isEmpty = ops.length === 0

  return (
    <box flexGrow={1} flexShrink={1} flexDirection="column" gap={0}>
      {ownOpsOnly ? (
        <text content="showing own operations only" fg={theme.warning} />
      ) : null}
      <DataTextTable content={content} theme={theme} />
      {isEmpty ? (
        <box flexShrink={0} paddingTop={0}>
          <text content="no active operations" fg={theme.textMuted} />
        </box>
      ) : null}
      {lockNote.trim() !== '' ? (
        <text content={displayText(lockNote)} fg={theme.warning} />
      ) : null}
    </box>
  )
}

function buildCurrentOpTableContent(
  ops: CurrentOpRow[],
  theme: Theme,
  rowCapacity: number,
): TextTableContent {
  const header: TextChunk[][] = [
    headerCell('OPID', theme),
    headerCell('NAMESPACE', theme),
    headerCell('OP', theme),
    headerCell('RUNNING (MS)', theme),
    headerCell('LOCK', theme),
    headerCell('WAITINGFOR', theme),
    headerCell('CLIENT', theme),
  ]

  const rows: TextTableContent = [header]

  for (const op of ops) {
    rows.push(buildCurrentOpRow(op, theme))
  }

  return padTableRows(rows, rowCapacity)
}

function buildCurrentOpRow(op: CurrentOpRow, theme: Theme): TextChunk[][] {
  const runningSeverity = runningMsSeverity(op.runningMs)
  const runningColor =
    runningSeverity === 'normal'
      ? theme.text
      : severityColor(theme, runningSeverity)

  return [
    tableCell(truncateLiveOpsCell(op.opid, 10), theme.text),
    tableCell(truncateLiveOpsCell(op.namespace, 24), theme.text),
    tableCell(truncateLiveOpsCell(op.op, 10), theme.text),
    tableCell(formatRunningMs(op.runningMs), runningColor),
    tableCell(truncateLiveOpsCell(op.lock, 16), theme.textMuted),
    tableCell(truncateLiveOpsCell(op.waitingFor, 16), theme.textMuted),
    tableCell(truncateLiveOpsCell(op.client, 20), theme.textMuted),
  ]
}
