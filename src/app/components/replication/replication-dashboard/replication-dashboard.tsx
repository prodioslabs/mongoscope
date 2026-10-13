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
const MEMBER_CARD_WIDTH = 30
const CONNECTOR_WIDTH = 8

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
      <RecentEventsPanel events={recentEvents} error={errors.recentEvents} isPending={pending} />
    </box>
  )

  const sideColumn = (
    <box
      flexShrink={0}
      flexDirection="column"
      gap={1}
      width={narrow ? undefined : RIGHT_PANEL_WIDTH}
    >
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
      <box
        flexGrow={1}
        flexShrink={1}
        flexDirection="column"
        paddingLeft={1}
        paddingRight={1}
        gap={1}
      >
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
  const dimensions = useTerminalDimensions()
  const narrowTree = dimensions.width < NARROW_WIDTH

  return (
    <PanelShell title={` ${setLabel} — topology `}>
      <box flexDirection="row" justifyContent="space-between" flexShrink={0}>
        <text content="Replica Set Topology" fg={theme.text} attributes={TextAttributes.BOLD} />
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
          <TopologyTree members={members} narrow={narrowTree} />
          <TopologyLegend />
        </box>
      )}

      <OplogSection oplog={oplog} error={oplogError} isPending={isPending} />
    </PanelShell>
  )
}

type TopologyTreeProps = {
  members: TopologyMember[]
  narrow: boolean
}

function TopologyTree({ members, narrow }: TopologyTreeProps) {
  const theme = useTheme((s) => s.theme)
  const { primary, others } = splitTopologyMembers(members)

  if (narrow || primary == null || others.length === 0) {
    return (
      <box flexDirection="column" gap={1} flexShrink={0} paddingTop={1}>
        {primary != null ? <MemberCard member={primary} /> : null}
        {others.map(function renderOther(member, index) {
          return (
            <box key={member.id} flexDirection="column" gap={0} flexShrink={0}>
              {primary != null ? (
                <text
                  content={displayText(index === others.length - 1 ? '└──▶' : '├──▶')}
                  fg={theme.border}
                  wrapMode="none"
                />
              ) : null}
              <MemberCard member={member} />
            </box>
          )
        })}
      </box>
    )
  }

  return (
    <box flexDirection="row" gap={1} flexShrink={0} paddingTop={1} alignItems="flex-start">
      <MemberCard member={primary} />
      <TopologyConnectors count={others.length} />
      <box flexDirection="column" gap={1} flexShrink={0}>
        {others.map(function renderOther(member) {
          return <MemberCard key={member.id} member={member} />
        })}
      </box>
    </box>
  )
}

type TopologyConnectorsProps = {
  count: number
}

function TopologyConnectors({ count }: TopologyConnectorsProps) {
  const theme = useTheme((s) => s.theme)
  const lines = connectorLines(count)

  return (
    <box
      flexDirection="column"
      flexShrink={0}
      width={CONNECTOR_WIDTH}
      justifyContent="flex-start"
      paddingTop={1}
    >
      {lines.map(function renderConnectorLine(line, index) {
        return (
          <text
            key={`conn-${index}`}
            content={displayText(line)}
            fg={theme.success}
            wrapMode="none"
            height={1}
          />
        )
      })}
    </box>
  )
}

type MemberCardProps = {
  member: TopologyMember
}

function MemberCard({ member }: MemberCardProps) {
  const theme = useTheme((s) => s.theme)
  const state = member.stateStr.toUpperCase()
  const isPrimary = state === 'PRIMARY'
  const borderColor = memberCardBorderColor(member, theme)
  const stateColor = isPrimary ? theme.success : theme.text
  const icon = memberRoleIcon(state)
  const hostLabel = formatShortHost(member.host)
  const meta = memberCardMeta(member)

  return (
    <box
      flexDirection="column"
      flexShrink={0}
      width={MEMBER_CARD_WIDTH}
      paddingLeft={1}
      paddingRight={1}
      paddingTop={0}
      paddingBottom={0}
      border
      borderStyle="single"
      borderColor={borderColor}
      backgroundColor={theme.backgroundElement}
      title={` ${state} `}
      titleColor={stateColor}
      titleAlignment="left"
    >
      <box flexDirection="row" gap={1} height={1} flexShrink={0}>
        <text content={displayText(icon)} fg={memberDotColor(member, theme)} wrapMode="none" />
        <text
          content={displayText(hostLabel)}
          fg={theme.text}
          attributes={TextAttributes.BOLD}
          wrapMode="none"
          flexShrink={1}
        />
        {member.self ? <text content="(self)" fg={theme.textMuted} wrapMode="none" /> : null}
      </box>
      <text
        content={displayText(meta)}
        fg={member.severity === 'warning' ? theme.warning : theme.textMuted}
        wrapMode="none"
      />
      <text
        content={displayText(member.host)}
        fg={theme.textMuted}
        wrapMode="none"
      />
    </box>
  )
}

function TopologyLegend() {
  const theme = useTheme((s) => s.theme)
  return (
    <box flexDirection="row" gap={2} flexShrink={0} paddingTop={1} paddingLeft={1} alignItems="center">
      <text content="Legend" fg={theme.textMuted} attributes={TextAttributes.BOLD} />
      <text content={displayText('★  PRIMARY')} fg={theme.success} wrapMode="none" />
      <text content={displayText('↓  SECONDARY')} fg={theme.info} wrapMode="none" />
      <text content={displayText('◇  ARBITER')} fg={theme.textMuted} wrapMode="none" />
      <text content={displayText('·  other')} fg={theme.textMuted} wrapMode="none" />
      <text content={displayText('lag  oplog delay')} fg={theme.textMuted} wrapMode="none" />
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
              <box
                key={`evt-${index}-${event.timestampMs ?? 0}`}
                flexDirection="row"
                gap={1}
                height={1}
              >
                <text
                  content={displayText(event.timestampLabel.padEnd(16, ' '))}
                  fg={theme.textMuted}
                  wrapMode="none"
                  flexShrink={0}
                />
                <text
                  content={displayText(event.message)}
                  fg={theme.text}
                  wrapMode="none"
                  flexShrink={1}
                />
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
                <text
                  content={displayText(formatPingMs(edge.pingMs))}
                  fg={theme.textMuted}
                  wrapMode="none"
                />
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

function memberCardBorderColor(member: TopologyMember, theme: Theme) {
  if (member.severity === 'error') {
    return theme.error
  }
  if (member.severity === 'warning') {
    return theme.warning
  }
  if (member.stateStr.toUpperCase() === 'PRIMARY') {
    return theme.success
  }
  return theme.border
}

function memberRoleIcon(state: string): string {
  if (state === 'PRIMARY') {
    return '★'
  }
  if (state === 'SECONDARY') {
    return '↓'
  }
  if (state === 'ARBITER') {
    return '◇'
  }
  return '·'
}

function memberCardMeta(member: TopologyMember): string {
  const state = member.stateStr.toUpperCase()
  if (state === 'PRIMARY') {
    return formatMemberMeta(member.priority, member.votes)
  }
  if (member.lagSeconds == null) {
    return formatMemberMeta(member.priority, member.votes)
  }
  return `lag ${formatLagSeconds(member.lagSeconds)} · ${formatMemberMeta(member.priority, member.votes)}`
}

function splitTopologyMembers(members: TopologyMember[]): {
  primary: TopologyMember | null
  others: TopologyMember[]
} {
  const primary =
    members.find(function findPrimary(member) {
      return member.stateStr.toUpperCase() === 'PRIMARY'
    }) ?? null
  const others = members.filter(function keepNonPrimary(member) {
    return primary == null || member.id !== primary.id
  })
  return { primary, others }
}

/**
 * ASCII branch from primary (left) to N member cards (right).
 * Each card is ~3 content rows + border; connectors align to card midlines.
 */
function connectorLines(count: number): string[] {
  if (count <= 0) {
    return []
  }
  if (count === 1) {
    return ['', '───▶', '']
  }

  // MemberCard: title border + 3 content lines + bottom border ≈ 5 rows; gap={1} between cards.
  const cardStride = 6
  const midOffset = 2
  const totalRows = (count - 1) * cardStride + 5
  const lines = Array.from({ length: totalRows }, () => '        ')

  for (let i = 0; i < count; i++) {
    const row = i * cardStride + midOffset
    if (i === 0) {
      lines[row] = '──┬───▶'
      continue
    }
    if (i === count - 1) {
      lines[row] = '  └───▶'
      continue
    }
    lines[row] = '  ├───▶'
  }

  const firstMid = midOffset
  const lastMid = (count - 1) * cardStride + midOffset
  for (let row = firstMid + 1; row < lastMid; row++) {
    if (lines[row] === '        ') {
      lines[row] = '  │     '
    }
  }
  return lines
}
