import { TextAttributes } from '@opentui/core'
import { useRenderer } from '@opentui/react'
import { TABS, useSession, type AppTab } from '../../stores/session'
import { useTheme } from '../../stores/theme'
import { selectedForeground } from '../../theme'

export function TabBar() {
  const renderer = useRenderer()
  const theme = useTheme((s) => s.theme)
  const activeTab = useSession((s) => s.activeTab)
  const setTab = useSession((s) => s.setTab)
  const highlightFg = selectedForeground(theme)

  function selectTab(tabId: AppTab) {
    const focused = renderer.currentFocusedRenderable
    if (focused != null && typeof focused.blur === 'function') {
      focused.blur()
    }
    setTab(tabId)
  }

  return (
    <box
      width="100%"
      flexShrink={0}
      flexDirection="row"
      gap={1}
      zIndex={10}
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
            backgroundColor={active ? theme.primary : theme.transparent}
            onMouseDown={function onTabMouseDown(event: { stopPropagation(): void }) {
              event.stopPropagation()
              selectTab(tab.id)
            }}
            onMouseUp={function onTabMouseUp(event: { stopPropagation(): void }) {
              event.stopPropagation()
            }}
          >
            <text
              content={`${tab.key} ${tab.label}`}
              fg={fg}
              attributes={active ? TextAttributes.BOLD : undefined}
              onMouseDown={function onTabLabelMouseDown(event: { stopPropagation(): void }) {
                event.stopPropagation()
                selectTab(tab.id)
              }}
            />
          </box>
        )
      })}
    </box>
  )
}
