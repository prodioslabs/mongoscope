import { TextAttributes } from '@opentui/core'
import { useTerminalDimensions } from '@opentui/react'
import {
  formatBytes,
  formatGrowthRate,
  formatLagSeconds,
  formatMemberMeta,
  formatWindowHours,
  horizontalBarString,
  verticalBarChartLines,
  type LagTrendView,
  type OplogWindow,
  type ReplicationPanelError,
  type TopologyMember,
} from '../../../../replication'
import { displayText } from '../../../../lib/display-text'
import type { ReplicationQueryData } from '../../../queries/replication'
import { useTheme } from '../../../stores/theme'
import { type Theme } from '../../../theme'

type ReplicationDashboardProps = {
  data: ReplicationQueryData | undefined
  isPending: boolean
}

const NARROW_WIDTH = 100
const OPLOG_BAR_WIDTH = 40
const LAG_CHART_HEIGHT = 6
const RIGHT_PANEL_WIDTH = 34

export function ReplicationDashboard({ data, isPending }: ReplicationDashboardProps) {
  const theme = useTheme((s) => s.theme)
  const dimensions = useTerminalDimensions()
  const narrow = dimensions.width < NARROW_WIDTH

  const snapshot = data?.snapshot
  const lagTrend = data?.lagTrend ?? null
  const topology = snapshot?.topology ?? null
  const oplog = snapshot?.oplog ?? null
  const errors = snapshot?.errors ?? { topology: null, oplog: null }
  const members = topology?.members ?? []
  const setLabel = topology?.setName != null ? `replica set ${topology.setName}` : 'replica set'

  const mainPanel = (
    <TopologyOplogPanel
      setLabel={setLabel}
      memberCount={members.length}
      members={members}
      topologyError={errors.topology}
      oplog={oplog}
      oplogError={errors.oplog}
      isPending={isPending && snapshot == null}
    />
  )

  const lagPanel = <LagTrendPanel lagTrend={lagTrend} isPending={isPending && snapshot == null} />

  if (narrow) {
    return (
      <box flexGrow={1} flexShrink={1} flexDirection="column" paddingLeft={1} paddingRight={1} gap={1}>
        {mainPanel}
        {lagPanel}
      </box>
    )
  }

  return (
    <box flexGrow={1} flexShrink={1} flexDirection="row" paddingLeft={1} paddingRight={1} gap={1}>
      <box flexGrow={1} flexShrink={1} flexDirection="column">
        {mainPanel}
      </box>
      <box width={RIGHT_PANEL_WIDTH} flexShrink={0} flexDirection="column">
        {lagPanel}
      </box>
    </box>
  )
}

type TopologyOplogPanelProps = {
  setLabel: string
  memberCount: number
  members: TopologyMember[]
  topologyError: ReplicationPanelError | null
  oplog: OplogWindow | null
  oplogError: ReplicationPanelError | null
  isPending: boolean
}

function TopologyOplogPanel({
  setLabel,
  memberCount,
  members,
  topologyError,
  oplog,
  oplogError,
  isPending,
}: TopologyOplogPanelProps) {
  const theme = useTheme((s) => s.theme)

  return (
    <box
      flexGrow={1}
      flexShrink={1}
      flexDirection="column"
      gap={1}
      paddingLeft={1}
      paddingRight={1}
      paddingTop={0}
      paddingBottom={1}
      border
      borderStyle="single"
      borderColor={theme.border}
      backgroundColor={theme.backgroundPanel}
      title={` ${setLabel} — topology `}
      titleColor={theme.textMuted}
      titleAlignment="left"
    >
      <box flexDirection="row" justifyContent="flex-end" flexShrink={0}>
        <text
          content={displayText(memberCount === 1 ? '1 member' : `${memberCount} members`)}
          fg={theme.textMuted}
        />
      </box>

      {topologyError != null ? (
        <text content={displayText(topologyError.message)} fg={theme.error} />
      ) : isPending ? (
        <text content="loading…" fg={theme.textMuted} />
      ) : members.length === 0 ? (
        <text content="no replica set members" fg={theme.textMuted} />
      ) : (
        <box flexDirection="column" gap={0} flexShrink={0}>
          {members.map(function renderMember(member) {
            return <MemberRow key={member.id} member={member} />
          })}
        </box>
      )}

      <OplogSection oplog={oplog} error={oplogError} isPending={isPending} />
    </box>
  )
}

type MemberRowProps = {
  member: TopologyMember
}

function MemberRow({ member }: MemberRowProps) {
  const theme = useTheme((s) => s.theme)
  const dotColor = memberDotColor(member, theme)
  const stateColor = member.stateStr.toUpperCase() === 'PRIMARY' ? theme.success : theme.text
  const lagLabel =
    member.stateStr.toUpperCase() === 'PRIMARY' || member.lagSeconds == null
      ? '—'
      : formatLagSeconds(member.lagSeconds)

  return (
    <box flexDirection="row" gap={1} flexShrink={0} height={1}>
      <text content="●" fg={dotColor} wrapMode="none" flexShrink={0} />
      <text
        content={displayText(member.stateStr.padEnd(10, ' '))}
        fg={stateColor}
        attributes={TextAttributes.BOLD}
        wrapMode="none"
        flexShrink={0}
      />
      <text
        content={displayText(member.host)}
        fg={theme.text}
        wrapMode="none"
        flexShrink={1}
        flexGrow={1}
      />
      <text
        content={displayText(formatMemberMeta(member.priority, member.votes))}
        fg={theme.textMuted}
        wrapMode="none"
        flexShrink={0}
      />
      <text
        content={displayText(lagLabel.padStart(6, ' '))}
        fg={member.severity === 'warning' ? theme.warning : theme.textMuted}
        wrapMode="none"
        flexShrink={0}
      />
    </box>
  )
}

type OplogSectionProps = {
  oplog: OplogWindow | null
  error: ReplicationPanelError | null
  isPending: boolean
}

function OplogSection({ oplog, error, isPending }: OplogSectionProps) {
  const theme = useTheme((s) => s.theme)
  const dimensions = useTerminalDimensions()
  const barWidth = Math.min(OPLOG_BAR_WIDTH, Math.max(16, dimensions.width - 50))

  return (
    <box flexDirection="column" gap={0} flexShrink={0} paddingTop={1}>
      <box flexDirection="row" justifyContent="space-between" flexShrink={0}>
        <text content="oplog window" fg={theme.textMuted} />
        <text
          content={displayText(
            oplog?.windowHours != null ? `${formatWindowHours(oplog.windowHours)} remaining` : '—',
          )}
          fg={theme.text}
        />
      </box>

      {error != null ? (
        <text content={displayText(error.message)} fg={theme.error} />
      ) : isPending ? (
        <text content="loading…" fg={theme.textMuted} />
      ) : oplog == null ? (
        <text content="unavailable" fg={theme.textMuted} />
      ) : (
        <>
          <text
            content={horizontalBarString(oplog.fillPercent, barWidth)}
            fg={oplog.fillsOverMax ? theme.warning : theme.info}
            wrapMode="none"
          />
          <box flexDirection="row" justifyContent="space-between" flexShrink={0}>
            <text
              content={displayText(
                `oplog size: ${formatBytes(oplog.usedBytes)}${
                  oplog.maxBytes > 0 ? ` / ${formatBytes(oplog.maxBytes)}` : ''
                }`,
              )}
              fg={theme.textMuted}
            />
            <text
              content={displayText(`growth rate: ${formatGrowthRate(oplog.growthBytesPerHour)}`)}
              fg={theme.textMuted}
            />
          </box>
        </>
      )}
    </box>
  )
}

type LagTrendPanelProps = {
  lagTrend: LagTrendView | null
  isPending: boolean
}

function LagTrendPanel({ lagTrend, isPending }: LagTrendPanelProps) {
  const theme = useTheme((s) => s.theme)
  const titleMember =
    lagTrend != null ? shortHost(lagTrend.memberName) : '—'
  const chartLines =
    lagTrend != null && !lagTrend.collecting
      ? verticalBarChartLines(lagTrend.bars, LAG_CHART_HEIGHT)
      : null

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
      title={` lag trend — ${titleMember} `}
      titleColor={theme.textMuted}
      titleAlignment="left"
    >
      <box flexDirection="row" justifyContent="flex-end" flexShrink={0}>
        <text content="10m" fg={theme.textMuted} />
      </box>

      {isPending ? (
        <text content="loading…" fg={theme.textMuted} />
      ) : lagTrend == null ? (
        <text content="no secondary lag to chart" fg={theme.textMuted} />
      ) : lagTrend.collecting || chartLines == null ? (
        <text content="collecting samples…" fg={theme.textMuted} />
      ) : (
        <box flexDirection="column" gap={0} flexShrink={0} height={LAG_CHART_HEIGHT}>
          {chartLines.map(function renderChartLine(line, index) {
            return (
              <text
                key={`lag-bar-${index}`}
                content={line}
                fg={theme.warning}
                wrapMode="none"
                height={1}
              />
            )
          })}
        </box>
      )}

      <box flexDirection="row" justifyContent="space-between" flexShrink={0} paddingTop={1}>
        <text
          content={displayText(
            `peak lag  ${lagTrend != null ? formatLagSeconds(lagTrend.peakLagSeconds) : '—'}`,
          )}
          fg={theme.textMuted}
        />
        <text
          content={displayText(
            `current  ${lagTrend != null ? formatLagSeconds(lagTrend.currentLagSeconds) : '—'}`,
          )}
          fg={theme.text}
        />
      </box>
    </box>
  )
}

function memberDotColor(member: TopologyMember, theme: Theme) {
  if (member.severity === 'error') {
    return theme.error
  }
  if (member.severity === 'warning') {
    return theme.warning
  }
  if (member.stateStr.toUpperCase() === 'PRIMARY') {
    return theme.success
  }
  // Healthy secondary — mockup uses info/blue, not the same green as PRIMARY.
  return theme.info
}

function shortHost(hostPort: string): string {
  const host = hostPort.includes(':') ? hostPort.slice(0, hostPort.lastIndexOf(':')) : hostPort
  const firstLabel = host.split('.')[0]
  return firstLabel != null && firstLabel !== '' ? firstLabel : host
}
