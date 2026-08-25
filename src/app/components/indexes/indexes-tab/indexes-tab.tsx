import { displayText } from '../../../../lib/display-text'
import { useConnectionsList } from '../../../queries/connection'
import { useSession } from '../../../stores/session'
import { useTheme } from '../../../stores/theme'
import { DbSelector } from '../../db-selector'

export function IndexesTab() {
  const theme = useTheme((s) => s.theme)
  const activeConnectionId = useSession((s) => s.activeConnectionId)
  const { data } = useConnectionsList()
  const profiles = data ?? []
  const activeProfile =
    activeConnectionId == null
      ? null
      : (profiles.find((profile) => profile.id === activeConnectionId) ?? null)

  let status: string
  if (profiles.length === 0) {
    status = 'Add a connection above to get started. Index insights are not wired up yet.'
  } else if (activeProfile == null) {
    status = 'No connection selected. Press c to choose one. Index insights are not wired up yet.'
  } else {
    status = `Selected “${activeProfile.name}” (${activeProfile.hostLabel}). Connection is saved — index insights are not connected yet.`
  }

  return (
    <box flexGrow={1} flexShrink={1} flexDirection="column">
      <DbSelector />
      <box flexGrow={1} paddingLeft={1} paddingTop={1} flexDirection="column" gap={1}>
        <text content="Indexes" fg={theme.text} />
        <text content={displayText(status)} fg={theme.textMuted} />
      </box>
    </box>
  )
}
