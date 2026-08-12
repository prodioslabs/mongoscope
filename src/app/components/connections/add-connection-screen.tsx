import { InputRenderable, TextAttributes } from '@opentui/core'
import { useBindings } from '@opentui/keymap/react'
import { useEffect, useRef, useState } from 'react'
import { connectionStore } from '../../../connections'
import { formatConnectionError } from '../../../lib/format-connection-error'
import { DEFAULT_LOCAL_MONGODB_URI } from '../../../lib/mongodb-uri'
import { type AppKeymapMode } from '../../lib/keymap-mode'
import { type FooterKeybinding } from '../../stores/footer'
import { useSession } from '../../stores/session'
import { useTheme } from '../../stores/theme'
import { useFooterKeybindings } from '../footer-keybindings'

const ADD_CONNECTION_KEYBINDINGS: FooterKeybinding[] = [
  { keys: 'tab', label: 'field' },
  { keys: '→', label: 'local URI' },
  { keys: 'enter', label: 'save' },
  { keys: 'esc', label: 'cancel' },
]

type FocusField = 'name' | 'uri'

export function AddConnectionScreen() {
  const theme = useTheme((s) => s.theme)
  const goToConnections = useSession((s) => s.goToConnections)

  const [name, setName] = useState('')
  const [uri, setUri] = useState('')
  const [focusField, setFocusField] = useState<FocusField>('name')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const nameInputRef = useRef<InputRenderable | null>(null)
  const uriInputRef = useRef<InputRenderable | null>(null)
  const nameRef = useRef(name)
  const uriRef = useRef(uri)
  const savingRef = useRef(saving)
  const focusFieldRef = useRef(focusField)

  nameRef.current = name
  uriRef.current = uri
  savingRef.current = saving
  focusFieldRef.current = focusField

  useFooterKeybindings(ADD_CONNECTION_KEYBINDINGS)

  useEffect(
    function focusActiveFieldInput() {
      const timer = setTimeout(function focusInput() {
        const input = focusField === 'name' ? nameInputRef.current : uriInputRef.current
        if (!input || input.isDestroyed) {
          return
        }
        input.focus()
      }, 1)
      return function clearFocusTimer() {
        clearTimeout(timer)
      }
    },
    [focusField],
  )

  async function saveConnection() {
    if (savingRef.current) {
      return
    }

    const nextName = nameRef.current.trim()
    const nextUri = uriRef.current.trim()
    if (nextName === '' || nextUri === '') {
      setError('Name and URI are required')
      return
    }

    setSaving(true)
    setError(null)

    try {
      await connectionStore.add({ name: nextName, uri: nextUri })
      goToConnections()
    } catch (caught) {
      setError(formatConnectionError(caught))
    } finally {
      setSaving(false)
    }
  }

  const saveConnectionRef = useRef(saveConnection)
  saveConnectionRef.current = saveConnection

  useBindings(
    function createAddConnectionLayer() {
      const canAcceptDefaultUri = focusField === 'uri' && uri === ''

      return {
        appMode: 'palette' satisfies AppKeymapMode,
        // CommandPalette also uses palette mode and binds enter → palette.submit
        // (including when closed). Win over that layer so Enter saves here.
        priority: canAcceptDefaultUri ? 100 : 10,
        enabled: !saving,
        commands: [
          {
            name: 'connection-add.accept-uri-default',
            run() {
              if (focusFieldRef.current !== 'uri' || uriRef.current !== '') {
                return false
              }
              setUri(DEFAULT_LOCAL_MONGODB_URI)
            },
          },
          {
            name: 'connection-add.submit',
            run() {
              if (focusFieldRef.current === 'name') {
                setFocusField('uri')
              } else {
                void saveConnectionRef.current()
              }
            },
          },
          {
            name: 'connection-add.toggle-field',
            run() {
              setFocusField((field) => (field === 'name' ? 'uri' : 'name'))
            },
          },
          {
            name: 'connection-add.cancel',
            run() {
              goToConnections()
            },
          },
        ],
        bindings: [
          ...(canAcceptDefaultUri
            ? [{ key: 'right' as const, cmd: 'connection-add.accept-uri-default' as const }]
            : []),
          { key: 'return', cmd: 'connection-add.submit' },
          { key: 'enter', cmd: 'connection-add.submit' },
          { key: 'tab', cmd: 'connection-add.toggle-field' },
          { key: 'escape', cmd: 'connection-add.cancel' },
        ],
      }
    },
    [focusField, goToConnections, saving, uri],
  )

  return (
    <box flexGrow={1} flexDirection="column" paddingLeft={2} paddingRight={2} paddingTop={1} gap={1}>
      <text fg={theme.text} attributes={TextAttributes.BOLD}>
        Add connection
      </text>
      <text fg={theme.textMuted}>
        Stores the URI in the OS keychain. Metadata (name, host) is saved locally.
      </text>

      <box flexDirection="column" gap={0}>
        <text fg={focusField === 'name' ? theme.accent : theme.textMuted}>Name</text>
        <input
          ref={nameInputRef}
          value={name}
          onInput={setName}
          onSubmit={() => setFocusField('uri')}
          focusedBackgroundColor={theme.backgroundElement}
          backgroundColor={theme.backgroundElement}
          cursorColor={theme.primary}
          focusedTextColor={theme.text}
          textColor={theme.text}
          placeholder="e.g. local"
          placeholderColor={theme.textMuted}
        />
      </box>

      <box flexDirection="column" gap={0}>
        <text fg={focusField === 'uri' ? theme.accent : theme.textMuted}>URI</text>
        <input
          ref={uriInputRef}
          value={uri}
          onInput={setUri}
          onSubmit={() => {
            void saveConnection()
          }}
          focusedBackgroundColor={theme.backgroundElement}
          backgroundColor={theme.backgroundElement}
          cursorColor={theme.primary}
          focusedTextColor={theme.text}
          textColor={theme.text}
          placeholder={DEFAULT_LOCAL_MONGODB_URI}
          placeholderColor={theme.textMuted}
        />
      </box>

      {error ? <text fg={theme.error}>{error}</text> : null}
      {saving ? <text fg={theme.textMuted}>Saving…</text> : null}
    </box>
  )
}
