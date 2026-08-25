import { TextAttributes } from '@opentui/core'
import { useBindings } from '@opentui/keymap/react'
import { type ConnectionProfile } from '../../../connections'
import { formatConnectionError } from '../../../connections/format-connection-error'
import { displayText } from '../../../lib/display-text'
import { type AppKeymapMode } from '../../lib/keymap-mode'
import { useConnectionsList } from '../../queries/connection'
import { CONNECTIONS_TAB_FOOTER, CONNECTIONS_TAB_SHORTCUTS, toBindings } from '../../shortcuts'
import { useConnectionsUi } from '../../stores/connections-ui'
import { type FooterKeybinding } from '../../stores/footer'
import { useSession } from '../../stores/session'
import { useTheme } from '../../stores/theme'
import { useFooterKeybindings } from '../footer-keybindings'
import { AddConnectionForm } from '../connections/add-connection-form'

const EMPTY_FOOTER_KEYBINDINGS: FooterKeybinding[] = []

export function DbSelector() {
  const theme = useTheme((s) => s.theme)
  const activeConnectionId = useSession((s) => s.activeConnectionId)
  const setActiveConnectionId = useSession((s) => s.setActiveConnectionId)
  const openManage = useConnectionsUi((s) => s.openManage)
  const dialogOpen = useConnectionsUi((s) => s.dialogOpen)

  const { data, isPending, isError, error } = useConnectionsList()
  const profiles: ConnectionProfile[] = data ?? []
  const hasSavedConnections = profiles.length > 0

  const activeProfile =
    activeConnectionId == null
      ? null
      : (profiles.find((profile) => profile.id === activeConnectionId) ?? null)

  useFooterKeybindings(
    hasSavedConnections && !dialogOpen ? CONNECTIONS_TAB_FOOTER : EMPTY_FOOTER_KEYBINDINGS,
  )

  useBindings(
    function createDbSelectorManageLayer() {
      return {
        appMode: 'base' satisfies AppKeymapMode,
        enabled: hasSavedConnections && !dialogOpen,
        commands: [
          {
            name: 'connections.open-manage',
            run() {
              openManage()
            },
          },
        ],
        bindings: toBindings(CONNECTIONS_TAB_SHORTCUTS),
      }
    },
    [dialogOpen, hasSavedConnections, openManage],
  )

  if (isPending) {
    return (
      <box flexShrink={0} paddingLeft={1} paddingTop={1} paddingBottom={1}>
        <text content="Loading connections…" fg={theme.textMuted} />
      </box>
    )
  }

  if (isError) {
    return (
      <box flexShrink={0} paddingLeft={1} paddingTop={1} paddingBottom={1}>
        <text content={displayText(formatConnectionError(error))} fg={theme.error} />
      </box>
    )
  }

  if (!hasSavedConnections) {
    return (
      <box flexShrink={0} paddingLeft={1} paddingTop={1} paddingRight={1} paddingBottom={1}>
        <AddConnectionForm
          appMode="base"
          enabled={!dialogOpen}
          showFooterKeybindings={!dialogOpen}
          onSuccess={function onInlineAddSuccess(profile) {
            setActiveConnectionId(profile.id)
          }}
          onCancel={function onInlineAddCancel() {
            // Inline empty-state: nothing to leave; keep the form for another try.
          }}
        />
      </box>
    )
  }

  const label =
    activeProfile != null
      ? `${activeProfile.name} · ${activeProfile.hostLabel}`
      : 'no connection selected'

  return (
    <box
      flexShrink={0}
      flexDirection="row"
      gap={1}
      paddingLeft={1}
      paddingTop={1}
      paddingRight={1}
      paddingBottom={1}
      onMouseDown={function openConnectionsOnClick() {
        openManage()
      }}
    >
      <text content="DB" fg={theme.textMuted} attributes={TextAttributes.BOLD} flexShrink={0} />
      <text content={displayText(label)} fg={activeProfile != null ? theme.text : theme.textMuted} />
      <text content="[c]" fg={theme.textMuted} flexShrink={0} />
    </box>
  )
}
