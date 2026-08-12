import { TextAttributes } from '@opentui/core'
import { useBindings } from '@opentui/keymap/react'
import { useEffect, useRef, useState } from 'react'
import { connectionsFilePath, type ConnectionProfile } from '../../../connections'
import { displayText } from '../../../lib/display-text'
import { formatConnectionError } from '../../../lib/format-connection-error'
import { useConnectionsList, useRemoveConnection } from '../../../queries/connection'
import { type AppKeymapMode } from '../../lib/keymap-mode'
import { type FooterKeybinding } from '../../stores/footer'
import { useSession } from '../../stores/session'
import { useTheme } from '../../stores/theme'
import { selectedForeground } from '../../theme'
import { useFooterKeybindings } from '../footer-keybindings'
import { Dialog } from '../ui/dialog'

const CONNECTIONS_KEYBINDINGS: FooterKeybinding[] = [
  { keys: '↑↓/jk', label: 'navigate' },
  { keys: 'a', label: 'add' },
  { keys: 'd', label: 'delete' },
  { keys: 'esc', label: 'back' },
]

const DELETE_DIALOG_KEYBINDINGS: FooterKeybinding[] = [
  { keys: 'enter', label: 'confirm' },
  { keys: 'esc', label: 'cancel' },
]

export function ConnectionsScreen() {
  const theme = useTheme((s) => s.theme)
  const goToWelcome = useSession((s) => s.goToWelcome)
  const goToConnectionAdd = useSession((s) => s.goToConnectionAdd)

  const { data, isPending, isError, error } = useConnectionsList()
  const removeConnection = useRemoveConnection()

  const profiles: ConnectionProfile[] = data ?? []
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [pendingDelete, setPendingDelete] = useState<ConnectionProfile | null>(null)

  const profilesRef = useRef(profiles)
  const selectedIndexRef = useRef(selectedIndex)
  const pendingDeleteRef = useRef(pendingDelete)

  profilesRef.current = profiles
  selectedIndexRef.current = selectedIndex
  pendingDeleteRef.current = pendingDelete

  useEffect(
    function clampSelectedIndexToProfiles() {
      const length = data?.length ?? 0
      setSelectedIndex((index) => {
        if (length === 0) {
          return 0
        }
        return Math.min(index, length - 1)
      })
    },
    [data],
  )

  useFooterKeybindings(pendingDelete ? DELETE_DIALOG_KEYBINDINGS : CONNECTIONS_KEYBINDINGS)

  useBindings(
    function createConnectionsListLayer() {
      function moveSelection(delta: number) {
        const length = profilesRef.current.length
        if (length === 0) {
          return
        }
        setSelectedIndex((index) => {
          return (index + delta + length) % length
        })
      }

      return {
        appMode: 'base' satisfies AppKeymapMode,
        enabled: pendingDelete == null && !removeConnection.isPending,
        commands: [
          {
            name: 'connections.move-up',
            run() {
              moveSelection(-1)
            },
          },
          {
            name: 'connections.move-down',
            run() {
              moveSelection(1)
            },
          },
          {
            name: 'connections.add',
            run() {
              goToConnectionAdd()
            },
          },
          {
            name: 'connections.delete',
            run() {
              const profile = profilesRef.current[selectedIndexRef.current]
              if (!profile) {
                return
              }
              removeConnection.reset()
              setPendingDelete(profile)
            },
          },
          {
            name: 'connections.back',
            run() {
              goToWelcome()
            },
          },
        ],
        bindings: [
          { key: 'up', cmd: 'connections.move-up' },
          { key: 'k', cmd: 'connections.move-up' },
          { key: 'down', cmd: 'connections.move-down' },
          { key: 'j', cmd: 'connections.move-down' },
          { key: 'a', cmd: 'connections.add' },
          { key: 'n', cmd: 'connections.add' },
          { key: 'd', cmd: 'connections.delete' },
          { key: 'escape', cmd: 'connections.back' },
        ],
      }
    },
    [goToConnectionAdd, goToWelcome, pendingDelete, removeConnection],
  )

  useBindings(
    function createDeleteConfirmLayer() {
      return {
        appMode: 'base' satisfies AppKeymapMode,
        enabled: pendingDelete != null && !removeConnection.isPending,
        commands: [
          {
            name: 'connections.delete-confirm',
            run() {
              const profile = pendingDeleteRef.current
              if (!profile || removeConnection.isPending) {
                return
              }
              removeConnection.mutate(profile.id, {
                onSuccess() {
                  setPendingDelete(null)
                },
                onError() {
                  setPendingDelete(null)
                },
              })
            },
          },
          {
            name: 'connections.delete-cancel',
            run() {
              setPendingDelete(null)
            },
          },
        ],
        bindings: [
          { key: 'return', cmd: 'connections.delete-confirm' },
          { key: 'enter', cmd: 'connections.delete-confirm' },
          { key: 'escape', cmd: 'connections.delete-cancel' },
        ],
      }
    },
    [pendingDelete, removeConnection],
  )

  const highlightFg = selectedForeground(theme)
  const configPath = connectionsFilePath()

  let listStatus: string
  if (isPending) {
    listStatus = 'Loading saved connections…'
  } else if (profiles.length === 0) {
    listStatus = 'No saved connections yet. Press a to add one.'
  } else {
    listStatus = `${profiles.length} saved connections`
  }

  const loadError = isError ? formatConnectionError(error) : null
  const actionError =
    removeConnection.isError && removeConnection.error != null
      ? formatConnectionError(removeConnection.error)
      : null

  return (
    <box
      flexGrow={1}
      flexDirection="column"
      paddingLeft={2}
      paddingRight={2}
      paddingTop={1}
      gap={1}
    >
      <text content="Connections" fg={theme.text} attributes={TextAttributes.BOLD} />
      <text
        content={displayText(
          `${listStatus} · metadata in ${configPath} · URI in OS keychain · no live connect yet`,
        )}
        fg={theme.textMuted}
      />

      {loadError ? (
        <text content={displayText(loadError)} fg={theme.error} />
      ) : isPending ? null : profiles.length === 0 ? null : (
        <box flexDirection="column" gap={0}>
          {profiles.map((profile, index) => {
            const highlighted = index === selectedIndex
            const fg = highlighted ? highlightFg : theme.text
            return (
              <box
                key={profile.id}
                flexDirection="row"
                gap={1}
                paddingLeft={1}
                paddingRight={1}
                backgroundColor={highlighted ? theme.primary : undefined}
              >
                <text
                  content={displayText(profile.name, '—')}
                  fg={fg}
                  {...(highlighted ? { attributes: TextAttributes.BOLD } : {})}
                  flexShrink={0}
                />
                <text
                  content={displayText(profile.hostLabel, '—')}
                  fg={highlighted ? highlightFg : theme.textMuted}
                />
                {profile.tags.length > 0 ? (
                  <text
                    content={displayText(profile.tags.join(', '))}
                    fg={highlighted ? highlightFg : theme.textMuted}
                  />
                ) : null}
              </box>
            )
          })}
        </box>
      )}

      {actionError ? <text content={displayText(actionError)} fg={theme.error} /> : null}

      <Dialog
        open={pendingDelete != null}
        onClose={function closeDeleteDialog() {
          setPendingDelete(null)
        }}
      >
        <box paddingLeft={2} paddingRight={2} paddingBottom={1} gap={1}>
          <text content="Delete connection?" fg={theme.text} attributes={TextAttributes.BOLD} />
          <text
            content={displayText(
              pendingDelete
                ? `Remove “${pendingDelete.name}” (${pendingDelete.hostLabel}) from this machine.`
                : '',
            )}
            fg={theme.textMuted}
          />
          <text content="enter confirm · esc cancel" fg={theme.textMuted} />
        </box>
      </Dialog>
    </box>
  )
}
