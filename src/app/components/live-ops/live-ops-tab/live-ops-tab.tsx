import type { ReactNode } from 'react'
import { displayText } from '../../../../lib/display-text'
import { useConnectionsList } from '../../../queries/connection'
import { useLiveOpsSnapshot } from '../../../queries/live-ops'
import { useLiveConnection } from '../../../stores/live-connection'
import { useSession } from '../../../stores/session'
import { useTheme } from '../../../stores/theme'
import { DbSelector } from '../../db-selector'
import { LiveOpsDashboard } from '../live-ops-dashboard'

export function LiveOpsTab() {
  const theme = useTheme((s) => s.theme)
  const liveStatus = useLiveConnection((s) => s.status)
  const liveErrorMessage = useLiveConnection((s) => s.errorMessage)
  const activeConnectionId = useSession((s) => s.activeConnectionId)
  const { data: profilesData } = useConnectionsList()
  const profiles = profilesData ?? []

  const dashboardEnabled = liveStatus === 'connected'
  const { data: snapshot, isPending } = useLiveOpsSnapshot(dashboardEnabled)

  let body: ReactNode
  if (profiles.length === 0) {
    // DbSelector already shows the inline add form.
    body = null
  } else if (activeConnectionId == null || liveStatus === 'idle') {
    body = (
      <box paddingLeft={1} paddingTop={1}>
        <text content="No connection selected. Press c to choose one." fg={theme.textMuted} />
      </box>
    )
  } else if (liveStatus === 'connecting') {
    body = (
      <box paddingLeft={1} paddingTop={1}>
        <text content="connecting…" fg={theme.textMuted} />
      </box>
    )
  } else if (liveStatus === 'error') {
    body = (
      <box paddingLeft={1} paddingTop={1}>
        <text content={displayText(liveErrorMessage || 'Connection failed.')} fg={theme.error} />
      </box>
    )
  } else if (liveStatus === 'disconnected') {
    body = (
      <box paddingLeft={1} paddingTop={1}>
        <text
          content="Connection lost. Press c and reselect a connection to retry."
          fg={theme.warning}
        />
      </box>
    )
  } else if (liveStatus === 'connected') {
    body = <LiveOpsDashboard snapshot={snapshot} isPending={isPending} />
  } else {
    body = null
  }

  return (
    <box flexGrow={1} flexShrink={1} flexDirection="column">
      <DbSelector />
      {body}
    </box>
  )
}
