import { TextAttributes } from '@opentui/core'
import { useTerminalDimensions } from '@opentui/react'
import type { ReactNode } from 'react'
import {
  formatBytes,
  formatDefaultWriteConcern,
  formatGrowthRate,
  formatHeartbeatEdge,
  formatLagSeconds,
  formatMemberMeta,
  formatPingMs,
  formatShortHost,
  formatWindowHours,
  horizontalBarString,
  verticalBarChartLines,
  type HeartbeatsView,
  type LagTrendView,
  type OplogWindow,
  type RecentReplicationEvent,
  type ReplicationPanelError,
  type TopologyMember,
  type WriteConcernView,
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
const RIGHT_PANEL_WIDTH = 36
const RECENT_EVENTS_VISIBLE = 6

export function ReplicationDashboard({ data, isPending }: ReplicationDashboardProps) {
  const dimensions = useTerminalDimensions()
  const narrow = dimensions.width < NARROW_WIDTH

  const snapshot = data?.snapshot
  const lagTrend = data?.lagTrend ?? null
  const topology = snapshot?.topology ?? null
  const oplog = snapshot?.oplog ?? null
  const heartbeats = snapshot?.heartbeats ?? null
  const recentEvents = snapshot?.recentEvents ?? []
  const writeConcern = snapshot?.writeConcern ?? null
  const errors = snapshot?.errors ?? {
    topology: null,
    oplog: null,
    heartbeats: null,
    recentEvents: null,
    writeConcern: null,
  }
  const members = topology?.members ?? []
  const setLabel = topology?.setName != null ? `replica set ${topology.setName}` : 'replica set'
  const pending = isPending && snapshot == null

  const mainColumn = (
    <box flexGrow={1} flexShrink={1} flexDirection="column" gap={1}>
      <TopologyOplogPanel
        setLabel={setLabel}
        memberCount={members.length}
        members={members}
        topologyError={errors.topology}
        oplog={oplog}
        oplogError={errors.oplog}
        isPending={pending}
      />
      <RecentEventsPanel
        events={recentEvents}
        error={errors.recentEvents}
        isPending={pending}
      />
    </box>
  )

  const sideColumn = (
    <box flexShrink={0} flexDirection="column" gap={1} width={narrow ? undefined : RIGHT_PANEL_WIDTH}>
      <LagTrendPanel lagTrend={lagTrend} isPending={pending} />
      <HeartbeatsPanel heartbeats={heartbeats} error={errors.heartbeats} isPending={pending} />
      <WriteConcernPanel
        writeConcern={writeConcern}
        error={errors.writeConcern}
        isPending={pending}
      />
    </box>
  )

  if (narrow) {
    return (
      <box flexGrow={1} flexShrink={1} flexDirection="column" paddingLeft={1} paddingRight={1} gap={1}>
        {mainColumn}
        {sideColumn}
      </box>
    )
  }

  return (
    <box flexGrow={1} flexShrink={1} flexDirection="row" paddingLeft={1} paddingRight={1} gap={1}>
      {mainColumn}
      {sideColumn}
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
    <PanelShell title={` ${setLabel} — topology `}>
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
    </PanelShell>
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

type RecentEventsPanelProps = {
  events: RecentReplicationEvent[]
  error: ReplicationPanelError | null
  isPending: boolean
}

function RecentEventsPanel({ events, error, isPending }: RecentEventsPanelProps) {
  const theme = useTheme((s) => s.theme)
  const visible = events.slice(0, RECENT_EVENTS_VISIBLE)

  return (
    <PanelShell title=" recent elections & state changes " flexGrow>
      <box flexDirection="row" justifyContent="flex-end" flexShrink={0}>
        <text content="recent (server RAM log)" fg={theme.textMuted} />
      </box>

      {error != null ? (
        <text content={displayText(error.message)} fg={theme.error} />
      ) : isPending ? (
        <text content="loading…" fg={theme.textMuted} />
      ) : visible.length === 0 ? (
        <text content="no recent REPL/ELECTION events in log buffer" fg={theme.textMuted} />
      ) : (
        <box flexDirection="column" gap={0} flexShrink={0}>
          {visible.map(function renderEvent(event, index) {
            return (
              <box key={`evt-${index}-${event.timestampMs ?? 0}`} flexDirection="row" gap={1} height={1}>
                <text
                  content={displayText(event.timestampLabel.padEnd(16, ' '))}
                  fg={theme.textMuted}
                  wrapMode="none"
                  flexShrink={0}
                />
                <text content={displayText(event.message)} fg={theme.text} wrapMode="none" flexShrink={1} />
              </box>
            )
          })}
        </box>
      )}
    </PanelShell>
  )
}

type LagTrendPanelProps = {
  lagTrend: LagTrendView | null
  isPending: boolean
}

function LagTrendPanel({ lagTrend, isPending }: LagTrendPanelProps) {
  const theme = useTheme((s) => s.theme)
  const titleMember = lagTrend != null ? formatShortHost(lagTrend.memberName) : '—'
  const chartLines =
    lagTrend != null && !lagTrend.collecting
      ? verticalBarChartLines(lagTrend.bars, LAG_CHART_HEIGHT)
      : null

  return (
    <PanelShell title={` lag trend — ${titleMember} `}>
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
    </PanelShell>
  )
}

type HeartbeatsPanelProps = {
  heartbeats: HeartbeatsView | null
  error: ReplicationPanelError | null
  isPending: boolean
}

function HeartbeatsPanel({ heartbeats, error, isPending }: HeartbeatsPanelProps) {
  const theme = useTheme((s) => s.theme)
  const edges = heartbeats?.edges ?? []

  return (
    <PanelShell title=" heartbeats ">
      <box flexDirection="row" justifyContent="flex-end" flexShrink={0}>
        <text content="from this node" fg={theme.textMuted} />
      </box>

      {error != null ? (
        <text content={displayText(error.message)} fg={theme.error} />
      ) : isPending ? (
        <text content="loading…" fg={theme.textMuted} />
      ) : edges.length === 0 ? (
        <text content="no remote pings reported" fg={theme.textMuted} />
      ) : (
        <box flexDirection="column" gap={0} flexShrink={0}>
          {edges.map(function renderEdge(edge) {
            return (
              <box
                key={`${edge.fromName}->${edge.toName}`}
                flexDirection="row"
                justifyContent="space-between"
                height={1}
              >
                <text
                  content={displayText(formatHeartbeatEdge(edge.fromName, edge.toName))}
                  fg={theme.text}
                  wrapMode="none"
                />
                <text content={displayText(formatPingMs(edge.pingMs))} fg={theme.textMuted} wrapMode="none" />
              </box>
            )
          })}
        </box>
      )}
    </PanelShell>
  )
}

type WriteConcernPanelProps = {
  writeConcern: WriteConcernView | null
  error: ReplicationPanelError | null
  isPending: boolean
}

function WriteConcernPanel({ writeConcern, error, isPending }: WriteConcernPanelProps) {
  const theme = useTheme((s) => s.theme)

  return (
    <PanelShell title=" write concern ">
      {error != null ? (
        <text content={displayText(error.message)} fg={theme.error} />
      ) : isPending ? (
        <text content="loading…" fg={theme.textMuted} />
      ) : (
        <>
          <box flexDirection="row" justifyContent="space-between" height={1}>
            <text content="default" fg={theme.textMuted} />
            <text
              content={displayText(formatDefaultWriteConcern(writeConcern))}
              fg={theme.text}
              attributes={TextAttributes.BOLD}
            />
          </box>
          <box flexDirection="row" justifyContent="space-between" height={1}>
            <text content="w:majority avg wait" fg={theme.textMuted} />
            <text content="n/a" fg={theme.textMuted} />
          </box>
          <text content="majority wait not exposed read-only" fg={theme.textMuted} />
        </>
      )}
    </PanelShell>
  )
}

type PanelShellProps = {
  title: string
  children?: ReactNode
  flexGrow?: boolean
}

function PanelShell({ title, children, flexGrow = false }: PanelShellProps) {
  const theme = useTheme((s) => s.theme)
  return (
    <box
      flexGrow={flexGrow ? 1 : 0}
      flexShrink={flexGrow ? 1 : 0}
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
      title={title}
      titleColor={theme.textMuted}
      titleAlignment="left"
    >
      {children}
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
  return theme.info
}
