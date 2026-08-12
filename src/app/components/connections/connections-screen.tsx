import { TextAttributes } from '@opentui/core'
import { useBindings } from '@opentui/keymap/react'
import { useEffect, useRef, useState } from 'react'
import { connectionStore, connectionsFilePath, type ConnectionProfile } from '../../../connections'
import { displayText } from '../../../lib/display-text'
import { formatConnectionError } from '../../../lib/format-connection-error'
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

  const [profiles, setProfiles] = useState<ConnectionProfile[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<ConnectionProfile | null>(null)
  const [busy, setBusy] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)
  const [loading, setLoading] = useState(true)

  const profilesRef = useRef(profiles)
  const selectedIndexRef = useRef(selectedIndex)
  const pendingDeleteRef = useRef(pendingDelete)
  const busyRef = useRef(busy)

  profilesRef.current = profiles
  selectedIndexRef.current = selectedIndex
  pendingDeleteRef.current = pendingDelete
  busyRef.current = busy

  useFooterKeybindings(pendingDelete ? DELETE_DIALOG_KEYBINDINGS : CONNECTIONS_KEYBINDINGS)

  useEffect(
    function loadConnectionProfiles() {
      let cancelled = false

      async function load() {
        setLoading(true)
        try {
          const nextProfiles = await connectionStore.list()
          if (cancelled) {
            return
          }
          setProfiles(nextProfiles)
          setLoadError(null)
          setSelectedIndex((index) => {
            if (nextProfiles.length === 0) {
              return 0
            }
            return Math.min(index, nextProfiles.length - 1)
          })
        } catch (error) {
          if (cancelled) {
            return
          }
          setLoadError(formatConnectionError(error))
          setProfiles([])
        } finally {
          if (!cancelled) {
            setLoading(false)
          }
        }
      }

      void load()

      return function cancelLoadConnectionProfiles() {
        cancelled = true
      }
    },
    [reloadToken],
  )

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
        enabled: pendingDelete == null && !busy,
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
              setActionError(null)
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
    [busy, goToConnectionAdd, goToWelcome, pendingDelete],
  )

  useBindings(
    function createDeleteConfirmLayer() {
      return {
        appMode: 'base' satisfies AppKeymapMode,
        enabled: pendingDelete != null && !busy,
        commands: [
          {
            name: 'connections.delete-confirm',
            run() {
              const profile = pendingDeleteRef.current
              if (!profile || busyRef.current) {
                return
              }
              setBusy(true)
              void connectionStore
                .remove(profile.id)
                .then(function onRemoved() {
                  setPendingDelete(null)
                  setActionError(null)
                  setReloadToken((token) => token + 1)
                })
                .catch(function onRemoveFailed(error: unknown) {
                  setActionError(formatConnectionError(error))
                  setPendingDelete(null)
                })
                .finally(function clearBusy() {
                  setBusy(false)
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
    [busy, pendingDelete],
  )

  const highlightFg = selectedForeground(theme)
  const configPath = connectionsFilePath()

  let listStatus: string
  if (loading) {
    listStatus = 'Loading saved connections…'
  } else if (profiles.length === 0) {
    listStatus = 'No saved connections yet. Press a to add one.'
  } else {
    listStatus = `${profiles.length} saved connections`
  }

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
      ) : loading ? null : profiles.length === 0 ? null : (
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
          <text
            content="Delete connection?"
            fg={theme.text}
            attributes={TextAttributes.BOLD}
          />
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
