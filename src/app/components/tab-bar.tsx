import { RGBA, TextAttributes } from '@opentui/core'
import { TABS, useSession } from '../stores/session'
import { useTheme } from '../stores/theme'
import { selectedForeground } from '../theme'

const TRANSPARENT = RGBA.fromInts(0, 0, 0, 0)

export function TabBar() {
  const theme = useTheme((s) => s.theme)
  const activeTab = useSession((s) => s.activeTab)
  const setTab = useSession((s) => s.setTab)
  const highlightFg = selectedForeground(theme)

  return (
    <box
      width="100%"
      flexShrink={0}
      flexDirection="row"
      gap={1}
      paddingLeft={1}
      paddingRight={1}
      backgroundColor={theme.backgroundPanel}
    >
      {TABS.map((tab) => {
        const active = tab.id === activeTab
        const fg = active ? highlightFg : theme.textMuted
        return (
          <box
            key={tab.id}
            flexDirection="row"
            paddingLeft={1}
            paddingRight={1}
            backgroundColor={active ? theme.primary : TRANSPARENT}
            onMouseDown={() => setTab(tab.id)}
          >
            <text
              content={`${tab.key} ${tab.label}`}
              fg={fg}
              attributes={active ? TextAttributes.BOLD : undefined}
            />
          </box>
        )
      })}
    </box>
  )
}
