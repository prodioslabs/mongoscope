import { TextAttributes } from '@opentui/core'
import type { ReactNode } from 'react'
import type {
  ConnectionStats,
  LiveOpsPanelError,
  LockWaitCount,
  QueuedOpsStats,
} from '../../../../live-ops'
import { displayText } from '../../../../lib/display-text'
import { useTheme } from '../../../stores/theme'

type LiveOpsSidebarProps = {
  connections: ConnectionStats | null
  queuedOps: QueuedOpsStats | null
  lockWaits: LockWaitCount[]
  serverStatusError: LiveOpsPanelError | null
  currentOpError: LiveOpsPanelError | null
}

export function LiveOpsSidebar({
  connections,
  queuedOps,
  lockWaits,
  serverStatusError,
  currentOpError,
}: LiveOpsSidebarProps) {
  const theme = useTheme((s) => s.theme)

  return (
    <box flexShrink={0} flexDirection="column" gap={1}>
      <SidebarBox title="connections">
        {serverStatusError != null ? (
          <text content={displayText(serverStatusError.message)} fg={theme.error} />
        ) : (
          <>
            <StatLine label="current" value={formatStat(connections?.current)} />
            <StatLine label="available" value={formatStat(connections?.available)} />
            <StatLine label="active" value={formatStat(connections?.active)} />
          </>
        )}
      </SidebarBox>

      <SidebarBox title="queued ops">
        {serverStatusError != null ? (
          <text content={displayText(serverStatusError.message)} fg={theme.error} />
        ) : (
          <>
            <StatLine label="read queue" value={formatStat(queuedOps?.readers)} />
            <StatLine label="write queue" value={formatStat(queuedOps?.writers)} />
          </>
        )}
      </SidebarBox>

      <SidebarBox title="lock waits">
        {currentOpError != null ? (
          <text content={displayText(currentOpError.message)} fg={theme.error} />
        ) : lockWaits.length === 0 ? (
          <text content="none" fg={theme.textMuted} />
        ) : (
          lockWaits.slice(0, 6).map(function renderLockWait(entry) {
            return (
              <text
                key={entry.namespace}
                content={displayText(`${truncateNs(entry.namespace)}  ${entry.count}`)}
                fg={theme.text}
              />
            )
          })
        )}
      </SidebarBox>
    </box>
  )
}

type SidebarBoxProps = {
  title: string
  children?: ReactNode
}

function SidebarBox({ title, children }: SidebarBoxProps) {
  const theme = useTheme((s) => s.theme)
  return (
    <box
      flexDirection="column"
      gap={0}
      paddingLeft={1}
      paddingRight={1}
      paddingTop={0}
      paddingBottom={0}
      border
      borderStyle="single"
      borderColor={theme.border}
    >
      <text content={displayText(title)} fg={theme.textMuted} attributes={TextAttributes.BOLD} />
      {children}
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
    <box flexDirection="row" gap={1}>
      <text content={displayText(label)} fg={theme.textMuted} />
      <text content={displayText(value)} fg={theme.text} />
    </box>
  )
}

function formatStat(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return '—'
  }
  return Math.round(value).toLocaleString('en-US')
}

function truncateNs(namespace: string): string {
  if (namespace.length <= 18) {
    return namespace
  }
  return `${namespace.slice(0, 17)}…`
}
