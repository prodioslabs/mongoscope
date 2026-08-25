import { TextAttributes } from '@opentui/core'
import { useBindings } from '@opentui/keymap/react'
import { useEffect, useRef, useState } from 'react'
import { type ConnectionProfile } from '../../../../connections'
import { formatConnectionError } from '../../../../connections/format-connection-error'
import { displayText } from '../../../../lib/display-text'
import { type AppKeymapMode } from '../../../lib/keymap-mode'
import { useConnectionsList, useRemoveConnection } from '../../../queries/connection'
import { useConnectionsUi } from '../../../stores/connections-ui'
import { useFooter, type FooterKeybinding } from '../../../stores/footer'
import { useSession } from '../../../stores/session'
import { useTheme } from '../../../stores/theme'
import { selectedForeground } from '../../../theme'
import { Dialog } from '../../ui/dialog'
import { AddConnectionForm } from '../add-connection-form'

const LIST_KEYBINDINGS: FooterKeybinding[] = [
  { keys: '↑↓/jk', label: 'navigate' },
  { keys: 'enter', label: 'select' },
  { keys: 'a', label: 'add' },
  { keys: 'd', label: 'delete' },
  { keys: 'esc', label: 'close' },
]

const DELETE_KEYBINDINGS: FooterKeybinding[] = [
  { keys: 'enter', label: 'confirm' },
  { keys: 'esc', label: 'cancel' },
]

const ADD_DIALOG_KEYBINDINGS: FooterKeybinding[] = [
  { keys: 'tab', label: 'field' },
  { keys: '→', label: 'local URI' },
  { keys: 'enter', label: 'save' },
  { keys: 'esc', label: 'back' },
]

export function ConnectionsDialog() {
  const theme = useTheme((s) => s.theme)
  const dialogOpen = useConnectionsUi((s) => s.dialogOpen)
  const dialogView = useConnectionsUi((s) => s.dialogView)
  const close = useConnectionsUi((s) => s.close)
  const setDialogView = useConnectionsUi((s) => s.setDialogView)
  const setActiveConnectionId = useSession((s) => s.setActiveConnectionId)
  const activeConnectionId = useSession((s) => s.activeConnectionId)
  const pushOverlayKeybindings = useFooter((s) => s.pushOverlayKeybindings)
  const popOverlayKeybindings = useFooter((s) => s.popOverlayKeybindings)

  const { data, isPending, isError, error } = useConnectionsList()
  const removeConnection = useRemoveConnection()

  const profiles: ConnectionProfile[] = data ?? []
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [pendingDelete, setPendingDelete] = useState<ConnectionProfile | null>(null)

  const profilesRef = useRef(profiles)
  const selectedIndexRef = useRef(selectedIndex)
  const pendingDeleteRef = useRef(pendingDelete)
  const dialogViewRef = useRef(dialogView)
  const activeConnectionIdRef = useRef(activeConnectionId)

  profilesRef.current = profiles
  selectedIndexRef.current = selectedIndex
  pendingDeleteRef.current = pendingDelete
  dialogViewRef.current = dialogView
  activeConnectionIdRef.current = activeConnectionId

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

  useEffect(
    function resetDialogStateWhenClosed() {
      if (dialogOpen) {
        return
      }
      setPendingDelete(null)
      setSelectedIndex(0)
    },
    [dialogOpen],
  )

  useEffect(
    function syncConnectionsDialogFooter() {
      if (!dialogOpen) {
        return
      }
      const bindings =
        pendingDelete != null
          ? DELETE_KEYBINDINGS
          : dialogView === 'add'
            ? ADD_DIALOG_KEYBINDINGS
            : LIST_KEYBINDINGS
      pushOverlayKeybindings('connections-dialog', bindings)
      return function clearConnectionsDialogFooter() {
        popOverlayKeybindings('connections-dialog')
      }
    },
    [
      dialogOpen,
      dialogView,
      pendingDelete,
      pushOverlayKeybindings,
      popOverlayKeybindings,
    ],
  )

  function handleClose() {
    if (pendingDeleteRef.current != null) {
      setPendingDelete(null)
      return
    }
    if (dialogViewRef.current === 'add') {
      if (profilesRef.current.length > 0) {
        setDialogView('list')
        return
      }
      close()
      return
    }
    close()
  }

  const handleCloseRef = useRef(handleClose)
  handleCloseRef.current = handleClose

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
        appMode: 'palette' satisfies AppKeymapMode,
        enabled:
          dialogOpen &&
          dialogView === 'list' &&
          pendingDelete == null &&
          !removeConnection.isPending,
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
            name: 'connections.select',
            run() {
              const profile = profilesRef.current[selectedIndexRef.current]
              if (!profile) {
                return
              }
              setActiveConnectionId(profile.id)
              close()
            },
          },
          {
            name: 'connections.add',
            run() {
              setDialogView('add')
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
            name: 'connections.close',
            run() {
              handleCloseRef.current()
            },
          },
        ],
        bindings: [
          { key: 'up', cmd: 'connections.move-up' },
          { key: 'k', cmd: 'connections.move-up' },
          { key: 'down', cmd: 'connections.move-down' },
          { key: 'j', cmd: 'connections.move-down' },
          { key: 'return', cmd: 'connections.select' },
          { key: 'enter', cmd: 'connections.select' },
          { key: 'a', cmd: 'connections.add' },
          { key: 'n', cmd: 'connections.add' },
          { key: 'd', cmd: 'connections.delete' },
          { key: 'escape', cmd: 'connections.close' },
        ],
      }
    },
    [
      close,
      dialogOpen,
      dialogView,
      pendingDelete,
      removeConnection,
      setActiveConnectionId,
      setDialogView,
    ],
  )

  useBindings(
    function createDeleteConfirmLayer() {
      return {
        appMode: 'palette' satisfies AppKeymapMode,
        enabled: dialogOpen && pendingDelete != null && !removeConnection.isPending,
        priority: 50,
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
                  if (activeConnectionIdRef.current === profile.id) {
                    setActiveConnectionId(null)
                  }
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
    [dialogOpen, pendingDelete, removeConnection, setActiveConnectionId],
  )

  const highlightFg = selectedForeground(theme)

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
    <Dialog
      open={dialogOpen}
      onClose={function closeConnectionsDialog() {
        handleCloseRef.current()
      }}
      width={64}
    >
      <box paddingLeft={2} paddingRight={2} paddingBottom={1} gap={1}>
        {pendingDelete != null ? (
          <>
            <text content="Delete connection?" fg={theme.text} attributes={TextAttributes.BOLD} />
            <text
              content={displayText(
                `Remove “${pendingDelete.name}” (${pendingDelete.hostLabel}) from this machine.`,
              )}
              fg={theme.textMuted}
            />
            <text content="enter confirm · esc cancel" fg={theme.textMuted} />
            {actionError ? <text content={displayText(actionError)} fg={theme.error} /> : null}
          </>
        ) : dialogView === 'add' ? (
          <AddConnectionForm
            appMode="palette"
            enabled={dialogOpen && dialogView === 'add'}
            onSuccess={function onAddSuccess(profile) {
              setActiveConnectionId(profile.id)
              close()
            }}
            onCancel={function onAddCancel() {
              handleCloseRef.current()
            }}
          />
        ) : (
          <>
            <text content="Connections" fg={theme.text} attributes={TextAttributes.BOLD} />
            <text
              content={displayText(`${listStatus} · stored in OS keychain · no live connect yet`)}
              fg={theme.textMuted}
            />

            {loadError ? (
              <text content={displayText(loadError)} fg={theme.error} />
            ) : isPending ? null : profiles.length === 0 ? null : (
              <box flexDirection="column" gap={0}>
                {profiles.map((profile, index) => {
                  const highlighted = index === selectedIndex
                  const isActive = profile.id === activeConnectionId
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
                        content={displayText(isActive ? '●' : '○')}
                        fg={highlighted ? highlightFg : theme.textMuted}
                        flexShrink={0}
                      />
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
          </>
        )}
      </box>
    </Dialog>
  )
}
