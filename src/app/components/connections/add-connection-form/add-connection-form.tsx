import { InputRenderable, TextAttributes } from '@opentui/core'
import { useBindings } from '@opentui/keymap/react'
import { useEffect, useRef, useState } from 'react'
import { type ConnectionProfile } from '../../../../connections'
import { formatConnectionError } from '../../../../connections/format-connection-error'
import { displayText } from '../../../../lib/display-text'
import { DEFAULT_LOCAL_MONGODB_URI } from '../../../../lib/mongodb-uri'
import { type AppKeymapMode } from '../../../lib/keymap-mode'
import { useAddConnection } from '../../../queries/connection'
import { type FooterKeybinding } from '../../../stores/footer'
import { useTheme } from '../../../stores/theme'
import { useFooterKeybindings } from '../../footer-keybindings'

export const ADD_CONNECTION_FORM_KEYBINDINGS: FooterKeybinding[] = [
  { keys: 'tab', label: 'field' },
  { keys: '→', label: 'local URI' },
  { keys: 'enter', label: 'save' },
  { keys: 'esc', label: 'cancel' },
]

const EMPTY_FOOTER_KEYBINDINGS: FooterKeybinding[] = []

type FocusField = 'name' | 'uri'

type AddConnectionFormProps = {
  appMode: AppKeymapMode
  enabled?: boolean
  showFooterKeybindings?: boolean
  onSuccess: (profile: ConnectionProfile) => void
  onCancel: () => void
}

export function AddConnectionForm({
  appMode,
  enabled = true,
  showFooterKeybindings = false,
  onSuccess,
  onCancel,
}: AddConnectionFormProps) {
  const theme = useTheme((s) => s.theme)
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
  const onSuccessRef = useRef(onSuccess)
  const onCancelRef = useRef(onCancel)

  nameRef.current = name
  uriRef.current = uri
  focusFieldRef.current = focusField
  onSuccessRef.current = onSuccess
  onCancelRef.current = onCancel

  useFooterKeybindings(
    showFooterKeybindings ? ADD_CONNECTION_FORM_KEYBINDINGS : EMPTY_FOOTER_KEYBINDINGS,
  )

  useEffect(
    function focusActiveFieldInput() {
      if (!enabled) {
        return
      }
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
    [enabled, focusField],
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
        onSuccess(profile) {
          onSuccessRef.current(profile)
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
    function createAddConnectionFormLayer() {
      const canAcceptDefaultUri = focusField === 'uri' && uri === ''

      return {
        appMode,
        ...(canAcceptDefaultUri ? { priority: 100 } : {}),
        enabled: enabled && !addConnection.isPending,
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
              onCancelRef.current()
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
    [addConnection.isPending, appMode, enabled, focusField, uri],
  )

  return (
    <box flexDirection="column" gap={1}>
      <text content="Add connection" fg={theme.text} attributes={TextAttributes.BOLD} />
      <text
        content="Stores connection details (including URI) in the OS keychain."
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
