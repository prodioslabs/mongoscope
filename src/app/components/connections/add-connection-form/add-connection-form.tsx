import { InputRenderable, TextAttributes } from '@opentui/core'
import { useBindings } from '@opentui/keymap/react'
import { useEffect, useRef, useState } from 'react'
import { type ConnectionProfile } from '../../../../connections'
import { formatConnectionError } from '../../../../connections/format-connection-error'
import { displayText } from '../../../../lib/display-text'
import { DEFAULT_LOCAL_MONGODB_URI } from '../../../../lib/mongodb-uri'
import { type AppKeymapMode } from '../../../lib/keymap-mode'
import { useAddConnection, useUpdateConnection } from '../../../queries/connection'
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

type ConnectionFormMode = 'add' | 'edit'

type AddConnectionFormProps = {
  appMode: AppKeymapMode
  enabled?: boolean
  /** When false, do not steal focus on mount (keeps dashboard 1–5 usable). */
  autoFocus?: boolean
  showFooterKeybindings?: boolean
  mode?: ConnectionFormMode
  /** Required when mode is `edit`. */
  editConnectionId?: string
  initialName?: string
  initialUri?: string
  onSuccess: (profile: ConnectionProfile) => void
  onCancel: () => void
}

export function AddConnectionForm({
  appMode,
  enabled = true,
  autoFocus = true,
  showFooterKeybindings = false,
  mode = 'add',
  editConnectionId,
  initialName = '',
  initialUri = '',
  onSuccess,
  onCancel,
}: AddConnectionFormProps) {
  const theme = useTheme((s) => s.theme)
  const addConnection = useAddConnection()
  const updateConnection = useUpdateConnection()
  const isEdit = mode === 'edit'
  const saving = isEdit ? updateConnection.isPending : addConnection.isPending

  const [name, setName] = useState(initialName)
  const [uri, setUri] = useState(initialUri)
  const [focusField, setFocusField] = useState<FocusField>(isEdit ? 'uri' : 'name')
  const [validationError, setValidationError] = useState<string | null>(null)

  const nameInputRef = useRef<InputRenderable | null>(null)
  const uriInputRef = useRef<InputRenderable | null>(null)
  const nameRef = useRef(name)
  const uriRef = useRef(uri)
  const focusFieldRef = useRef(focusField)
  const onSuccessRef = useRef(onSuccess)
  const onCancelRef = useRef(onCancel)
  const editConnectionIdRef = useRef(editConnectionId)

  nameRef.current = name
  uriRef.current = uri
  focusFieldRef.current = focusField
  onSuccessRef.current = onSuccess
  onCancelRef.current = onCancel
  editConnectionIdRef.current = editConnectionId

  useFooterKeybindings(
    showFooterKeybindings ? ADD_CONNECTION_FORM_KEYBINDINGS : EMPTY_FOOTER_KEYBINDINGS,
  )

  useEffect(
    function syncInitialValuesWhenEditing() {
      setName(initialName)
      setUri(initialUri)
      setValidationError(null)
      setFocusField(isEdit ? 'uri' : 'name')
    },
    [initialName, initialUri, isEdit, editConnectionId],
  )

  function focusFieldInput(field: FocusField) {
    const input = field === 'name' ? nameInputRef.current : uriInputRef.current
    if (input == null || input.isDestroyed) {
      return
    }
    input.focus()
  }

  useEffect(
    function focusActiveFieldInput() {
      if (!enabled || !autoFocus) {
        return
      }
      const timer = setTimeout(function focusInput() {
        focusFieldInput(focusField)
      }, 1)
      return function clearFocusTimer() {
        clearTimeout(timer)
      }
    },
    [autoFocus, enabled, focusField],
  )

  function saveConnection() {
    if (saving) {
      return
    }

    const nextName = nameRef.current.trim()
    const nextUri = uriRef.current.trim()
    if (nextName === '' || nextUri === '') {
      setValidationError('Name and URI are required')
      return
    }

    setValidationError(null)

    if (isEdit) {
      const id = editConnectionIdRef.current
      if (id == null || id.trim() === '') {
        setValidationError('Connection id missing')
        return
      }
      updateConnection.reset()
      updateConnection.mutate(
        { id, name: nextName, uri: nextUri },
        {
          onSuccess(profile) {
            onSuccessRef.current(profile)
          },
        },
      )
      return
    }

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

  const mutationError = isEdit
    ? updateConnection.isError && updateConnection.error != null
      ? formatConnectionError(updateConnection.error)
      : null
    : addConnection.isError && addConnection.error != null
      ? formatConnectionError(addConnection.error)
      : null
  const error = validationError ?? mutationError

  useBindings(
    function createAddConnectionFormLayer() {
      const canAcceptDefaultUri = focusField === 'uri' && uri === ''

      return {
        appMode,
        // Above dashboard Tab-cycle (200) so Name↔URI wins; 1–5 still hit the dashboard layer
        // because this layer does not bind digit keys.
        priority: 250,
        enabled: enabled && !saving,
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
                focusFieldInput('uri')
              } else {
                saveConnectionRef.current()
              }
            },
          },
          {
            name: 'connection-add.toggle-field',
            run() {
              const nextField = focusFieldRef.current === 'name' ? 'uri' : 'name'
              setFocusField(nextField)
              focusFieldInput(nextField)
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
          { key: 'shift+tab', cmd: 'connection-add.toggle-field' },
          { key: 'escape', cmd: 'connection-add.cancel' },
        ],
      }
    },
    [appMode, enabled, focusField, saving, uri],
  )

  return (
    <box flexDirection="column" gap={1}>
      <text
        content={isEdit ? 'Edit connection' : 'Add connection'}
        fg={theme.text}
        attributes={TextAttributes.BOLD}
      />
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
          onSubmit={() => {
            setFocusField('uri')
            focusFieldInput('uri')
          }}
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
      {saving ? <text content="Saving…" fg={theme.textMuted} /> : null}
    </box>
  )
}
