import { TextAttributes, type TextChunk, type TextTableContent } from '@opentui/core'
import { useTerminalDimensions } from '@opentui/react'
import { partialBarString } from '../../../../live-ops'
import {
  formatBytes,
  formatGrowthRate,
  formatLagSeconds,
  formatMemberLabel,
  formatPriorityVotes,
  formatWindowHours,
  type MemberSeverity,
  type OplogWindow,
  type ReplicationPanelError,
  type ReplicationSnapshot,
  type TopologyMember,
} from '../../../../replication'
import { displayText } from '../../../../lib/display-text'
import {
  computeTableCapacity,
  headerCell,
  padTableRows,
  severityColor,
  tableCell,
  type Severity,
} from '../../../lib/text-table-content'
import { useTheme } from '../../../stores/theme'
import { type Theme } from '../../../theme'
import { DataTextTable } from '../../data-text-table'

type ReplicationDashboardProps = {
  snapshot: ReplicationSnapshot | undefined
  isPending: boolean
}

const NARROW_WIDTH = 100
const OPLOG_BAR_WIDTH = 28
/** Tab bar, footer, DbSelector, headers, oplog panel, padding. */
const REPLICATION_CHROME_ROWS = 18
const REPLICATION_NARROW_CHROME_ROWS = 24

export function ReplicationDashboard({ snapshot, isPending }: ReplicationDashboardProps) {
  const theme = useTheme((s) => s.theme)
  const dimensions = useTerminalDimensions()
  const narrow = dimensions.width < NARROW_WIDTH
  const chromeRows = narrow ? REPLICATION_NARROW_CHROME_ROWS : REPLICATION_CHROME_ROWS
  const rowCapacity = computeTableCapacity(chromeRows, dimensions.height)

  const topology = snapshot?.topology ?? null
  const oplog = snapshot?.oplog ?? null
  const errors = snapshot?.errors ?? { topology: null, oplog: null }
  const members = topology?.members ?? []
  const setLabel = topology?.setName != null ? topology.setName : 'replica set'

  const tableContent = buildTopologyTableContent(members, theme, rowCapacity)

  const topologyPanel = (
    <box flexGrow={1} flexShrink={1} flexDirection="column" gap={0}>
      <box flexDirection="row" justifyContent="space-between" flexShrink={0} paddingBottom={0}>
        <text
          content={displayText(`${setLabel} — topology`)}
          fg={theme.text}
          attributes={TextAttributes.BOLD}
        />
        <text
          content={displayText(isPending && snapshot == null ? 'refresh: …' : 'refresh: 5s')}
          fg={theme.textMuted}
        />
      </box>
      {errors.topology != null ? (
        <text content={displayText(errors.topology.message)} fg={theme.error} />
      ) : null}
      <DataTextTable content={tableContent} theme={theme} />
      {errors.topology == null && members.length === 0 && !isPending ? (
        <text content="no replica set members" fg={theme.textMuted} />
      ) : null}
    </box>
  )

  const oplogPanel = (
    <OplogWindowPanel oplog={oplog} error={errors.oplog} isPending={isPending && snapshot == null} />
  )

  return (
    <box flexGrow={1} flexShrink={1} flexDirection="column" paddingLeft={1} paddingRight={1} gap={1}>
      {narrow ? (
        <>
          {topologyPanel}
          {oplogPanel}
        </>
      ) : (
        <box flexGrow={1} flexShrink={1} flexDirection="row" gap={1}>
          <box flexGrow={1} flexShrink={1} flexDirection="column">
            {topologyPanel}
          </box>
          <box width={36} flexShrink={0} flexDirection="column">
            {oplogPanel}
          </box>
        </box>
      )}
    </box>
  )
}

type OplogWindowPanelProps = {
  oplog: OplogWindow | null
  error: ReplicationPanelError | null
  isPending: boolean
}

function OplogWindowPanel({ oplog, error, isPending }: OplogWindowPanelProps) {
  const theme = useTheme((s) => s.theme)

  return (
    <box
      flexShrink={0}
      flexDirection="column"
      gap={0}
      paddingLeft={1}
      paddingRight={1}
      paddingTop={0}
      paddingBottom={1}
      border
      borderStyle="single"
      borderColor={theme.border}
      backgroundColor={theme.backgroundPanel}
      title=" oplog window "
      titleColor={theme.textMuted}
      titleAlignment="left"
    >
      {error != null ? (
        <text content={displayText(error.message)} fg={theme.error} />
      ) : isPending ? (
        <text content="loading…" fg={theme.textMuted} />
      ) : oplog == null ? (
        <text content="unavailable" fg={theme.textMuted} />
      ) : (
        <>
          <box flexDirection="row" gap={1} flexShrink={0}>
            <text
              content={partialBarString(oplog.fillPercent, OPLOG_BAR_WIDTH)}
              fg={oplog.fillsOverMax ? theme.warning : theme.success}
              wrapMode="none"
            />
          </box>
          <StatLine
            label="fill"
            value={
              oplog.fillsOverMax
                ? `${oplog.fillPercent.toFixed(0)}% (over max)`
                : `${oplog.fillPercent.toFixed(0)}%`
            }
          />
          <StatLine label="window" value={formatWindowHours(oplog.windowHours)} />
          <StatLine
            label="size"
            value={`${formatBytes(oplog.usedBytes)} / ${formatBytes(oplog.maxBytes)}`}
          />
          <StatLine label="growth" value={formatGrowthRate(oplog.growthBytesPerHour)} />
        </>
      )}
    </box>
  )
}

type StatLineProps = {
  label: string
  value: string
}

function StatLine({ label, value }: StatLineProps) {
  const theme = useTheme((s) => s.theme)
  return (
    <box flexDirection="row" gap={1} flexShrink={0}>
      <text content={displayText(label.padEnd(7, ' '))} fg={theme.textMuted} wrapMode="none" />
      <text content={displayText(value)} fg={theme.text} wrapMode="none" />
    </box>
  )
}

function buildTopologyTableContent(
  members: TopologyMember[],
  theme: Theme,
  rowCapacity: number,
): TextTableContent {
  const header: TextChunk[][] = [
    headerCell('', theme),
    headerCell('MEMBER', theme),
    headerCell('STATE', theme),
    headerCell('HOST', theme),
    headerCell('PRI/V', theme),
    headerCell('LAG', theme),
  ]

  const rows: TextTableContent = [header]
  for (const member of members) {
    rows.push(buildTopologyRow(member, theme))
  }
  return padTableRows(rows, rowCapacity)
}

function buildTopologyRow(member: TopologyMember, theme: Theme): TextChunk[][] {
  const severity = memberSeverityToTableSeverity(member.severity)
  const dotColor = severityColor(theme, severity)
  const stateColor =
    member.severity === 'success'
      ? theme.success
      : member.severity === 'warning'
        ? theme.warning
        : theme.error

  return [
    tableCell('●', dotColor),
    tableCell(formatMemberLabel(member.name), theme.text),
    tableCell(member.stateStr, stateColor),
    tableCell(member.host, theme.textMuted),
    tableCell(formatPriorityVotes(member.priority, member.votes), theme.textMuted),
    tableCell(formatLagSeconds(member.lagSeconds), theme.text),
  ]
}

function memberSeverityToTableSeverity(severity: MemberSeverity): Severity {
  switch (severity) {
    case 'success':
      return 'success'
    case 'warning':
      return 'warning'
    case 'error':
      return 'error'
  }
}
