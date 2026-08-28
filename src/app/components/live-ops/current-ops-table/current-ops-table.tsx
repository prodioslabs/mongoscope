import { TextAttributes } from '@opentui/core'
import {
  formatRunningMs,
  runningMsSeverity,
  truncateLiveOpsCell,
  type CurrentOpRow,
  type LiveOpsPanelError,
} from '../../../../live-ops'
import { displayText } from '../../../../lib/display-text'
import { type Theme } from '../../../theme'
import { useTheme } from '../../../stores/theme'

type CurrentOpsTableProps = {
  ops: CurrentOpRow[]
  error: LiveOpsPanelError | null
  ownOpsOnly: boolean
  lockNote: string
  maxRows?: number
}

const COL = {
  opid: 8,
  ns: 18,
  op: 8,
  running: 12,
  lock: 14,
  waiting: 14,
  client: 16,
} as const

export function CurrentOpsTable({
  ops,
  error,
  ownOpsOnly,
  lockNote,
  maxRows = 8,
}: CurrentOpsTableProps) {
  const theme = useTheme((s) => s.theme)

  if (error != null) {
    return (
      <box flexGrow={1} flexDirection="column" gap={0}>
        <text content={displayText(error.message)} fg={theme.error} />
      </box>
    )
  }

  const header = formatRow({
    opid: 'OPID',
    namespace: 'NAMESPACE',
    op: 'OP',
    running: 'RUNNING(MS)',
    lock: 'LOCK',
    waiting: 'WAITINGFOR',
    client: 'CLIENT',
  })

  const visible = ops.slice(0, maxRows)

  return (
    <box flexGrow={1} flexShrink={1} flexDirection="column" gap={0}>
      {ownOpsOnly ? (
        <text content="showing own operations only" fg={theme.warning} />
      ) : null}
      <text content={displayText(header)} fg={theme.textMuted} attributes={TextAttributes.BOLD} />
      {visible.length === 0 ? (
        <text content="no active operations" fg={theme.textMuted} />
      ) : (
        visible.map(function renderOpRow(op) {
          const line = formatRow({
            opid: op.opid,
            namespace: truncateLiveOpsCell(op.namespace, COL.ns),
            op: truncateLiveOpsCell(op.op, COL.op),
            running: formatRunningMs(op.runningMs),
            lock: truncateLiveOpsCell(op.lock, COL.lock),
            waiting: truncateLiveOpsCell(op.waitingFor, COL.waiting),
            client: truncateLiveOpsCell(op.client, COL.client),
          })
          return (
            <text
              key={`${op.opid}-${op.namespace}-${op.op}`}
              content={displayText(line)}
              fg={runningColor(theme, op.runningMs)}
            />
          )
        })
      )}
      {lockNote.trim() !== '' ? (
        <text content={displayText(lockNote)} fg={theme.warning} />
      ) : null}
    </box>
  )
}

function formatRow(parts: {
  opid: string
  namespace: string
  op: string
  running: string
  lock: string
  waiting: string
  client: string
}): string {
  return [
    pad(parts.opid, COL.opid),
    pad(parts.namespace, COL.ns),
    pad(parts.op, COL.op),
    pad(parts.running, COL.running),
    pad(parts.lock, COL.lock),
    pad(parts.waiting, COL.waiting),
    pad(parts.client, COL.client),
  ].join(' ')
}

function pad(value: string, width: number): string {
  if (value.length >= width) {
    return value.slice(0, width)
  }
  return value.padEnd(width, ' ')
}

function runningColor(theme: Theme, runningMs: number) {
  const severity = runningMsSeverity(runningMs)
  if (severity === 'error') {
    return theme.error
  }
  if (severity === 'warning') {
    return theme.warning
  }
  return theme.text
}
