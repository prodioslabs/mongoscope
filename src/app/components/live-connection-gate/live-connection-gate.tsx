import type { ReactNode } from 'react'
import { displayText } from '../../../lib/display-text'
import { useConnectionsList } from '../../queries/connection'
import { useLiveConnection } from '../../stores/live-connection'
import { useSession } from '../../stores/session'
import { useTheme } from '../../stores/theme'

type LiveConnectionGateProps = {
  children: ReactNode
}

/**
 * Shared idle / connecting / error / disconnected messaging for live dashboards.
 * Renders `children` only when a live connection is active.
 */
export function LiveConnectionGate({ children }: LiveConnectionGateProps) {
  const theme = useTheme((s) => s.theme)
  const liveStatus = useLiveConnection((s) => s.status)
  const liveErrorMessage = useLiveConnection((s) => s.errorMessage)
  const activeConnectionId = useSession((s) => s.activeConnectionId)
  const { data: profilesData } = useConnectionsList()
  const profiles = profilesData ?? []

  // Empty keychain + no selection: DbSelector already shows the inline add form.
  // Do not blank the gate when an active connection exists (e.g. CLI --uri ephemeral).
  if (profiles.length === 0 && activeConnectionId == null) {
    return null
  }

  if (activeConnectionId == null || liveStatus === 'idle') {
    return (
      <box paddingLeft={1} paddingTop={1}>
        <text content="No connection selected. Press c to choose one." fg={theme.textMuted} />
      </box>
    )
  }

  if (liveStatus === 'connecting') {
    return (
      <box paddingLeft={1} paddingTop={1}>
        <text content="connecting…" fg={theme.textMuted} />
      </box>
    )
  }

  if (liveStatus === 'error') {
    return (
      <box paddingLeft={1} paddingTop={1}>
        <text content={displayText(liveErrorMessage || 'Connection failed.')} fg={theme.error} />
      </box>
    )
  }

  if (liveStatus === 'disconnected') {
    return (
      <box paddingLeft={1} paddingTop={1}>
        <text
          content="Connection lost. Press c and reselect a connection to retry."
          fg={theme.warning}
        />
      </box>
    )
  }

  if (liveStatus === 'connected') {
    return <>{children}</>
  }

  return null
}
