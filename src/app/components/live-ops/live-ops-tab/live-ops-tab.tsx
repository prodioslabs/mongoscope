import { useTheme } from '../../../stores/theme'
import { DbSelector } from '../../db-selector'

export function LiveOpsTab() {
  const theme = useTheme((s) => s.theme)

  return (
    <box flexGrow={1} flexShrink={1} flexDirection="column">
      <DbSelector />
      <box flexGrow={1} paddingLeft={1} paddingTop={1}>
        <text content="Live Ops" fg={theme.textMuted} />
      </box>
    </box>
  )
}
