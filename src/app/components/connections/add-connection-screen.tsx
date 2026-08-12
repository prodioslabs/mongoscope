import { InputRenderable, TextAttributes } from '@opentui/core'
import { useBindings } from '@opentui/keymap/react'
import { useEffect, useRef, useState } from 'react'
import { displayText } from '../../../lib/display-text'
import { formatConnectionError } from '../../../lib/format-connection-error'
import { DEFAULT_LOCAL_MONGODB_URI } from '../../../lib/mongodb-uri'
import { useAddConnection } from '../../../queries/connection'
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
  const addConnection = useAddConnection()

  const [name, setName] = useState('')
  const [uri, setUri] = useState('')
  const [focusField, setFocusField] = useState<FocusField>('name')
  const [validationError, setValidationError] = useState<string | null>(null)

  const nameInputRef = useRef<InputRenderable | null>(null)
  const uriInputRef = useRef<InputRenderable | null>(null)
  const nameRef = useRef(name)
  const uriRef = useRef(uri)
  const focusFieldRef = useRef(focusField)

  nameRef.current = name
  uriRef.current = uri
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

  function saveConnection() {
    if (addConnection.isPending) {
      return
    }

    const nextName = nameRef.current.trim()
    const nextUri = uriRef.current.trim()
    if (nextName === '' || nextUri === '') {
      setValidationError('Name and URI are required')
      return
    }

    setValidationError(null)
    addConnection.reset()
    addConnection.mutate(
      { name: nextName, uri: nextUri },
      {
        onSuccess() {
          goToConnections()
        },
      },
    )
  }

  const saveConnectionRef = useRef(saveConnection)
  saveConnectionRef.current = saveConnection

  const mutationError =
    addConnection.isError && addConnection.error != null
      ? formatConnectionError(addConnection.error)
      : null
  const error = validationError ?? mutationError

  useBindings(
    function createAddConnectionLayer() {
      const canAcceptDefaultUri = focusField === 'uri' && uri === ''

      return {
        appMode: 'palette' satisfies AppKeymapMode,
        // CommandPalette also uses palette mode and binds enter → palette.submit
        // (including when closed). Win over that layer so Enter saves here.
        priority: canAcceptDefaultUri ? 100 : 10,
        enabled: !addConnection.isPending,
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
                saveConnectionRef.current()
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
    [addConnection.isPending, focusField, goToConnections, uri],
  )

  return (
    <box
      flexGrow={1}
      flexDirection="column"
      paddingLeft={2}
      paddingRight={2}
      paddingTop={1}
      gap={1}
    >
      <text content="Add connection" fg={theme.text} attributes={TextAttributes.BOLD} />
      <text
        content="Stores the URI in the OS keychain. Metadata (name, host) is saved locally."
        fg={theme.textMuted}
      />

      <box flexDirection="column" gap={0}>
        <text content="Name" fg={focusField === 'name' ? theme.accent : theme.textMuted} />
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
        <text content="URI" fg={focusField === 'uri' ? theme.accent : theme.textMuted} />
        <input
          ref={uriInputRef}
          value={uri}
          onInput={setUri}
          onSubmit={() => {
            saveConnection()
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

      {error ? <text content={displayText(error)} fg={theme.error} /> : null}
      {addConnection.isPending ? <text content="Saving…" fg={theme.textMuted} /> : null}
    </box>
  )
}
