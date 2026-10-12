import { InputRenderable, TextAttributes } from '@opentui/core'
import { useBindings } from '@opentui/keymap/react'
import { useRenderer } from '@opentui/react'
import { stat } from 'node:fs/promises'
import { useEffect, useRef, useState } from 'react'
import { atomicWriteFile } from '../../../../lib/atomic-write-file'
import { displayText } from '../../../../lib/display-text'
import { resolveUserPath } from '../../../../lib/expand-home-path'
import { mapWriteError } from '../../../../lib/map-write-error'
import {
  defaultExportFilename,
  EXPORT_FORMATS,
  serializeSlowQueriesExport,
  syncPathExtension,
  type ExportFormat,
  type SlowQueriesExportDocument,
} from '../../../../query-patterns'
import { type AppKeymapMode } from '../../../lib/keymap-mode'
import { whenNotEditing } from '../../../lib/when-not-editing'
import {
  SLOW_QUERIES_EXPORT_DIALOG_FOOTER,
  SLOW_QUERIES_EXPORT_OVERWRITE_FOOTER,
} from '../../../shortcuts/slow-queries'
import { useFooter } from '../../../stores/footer'
import { useTheme } from '../../../stores/theme'
import { Dialog } from '../../ui/dialog'

type ExportDialogFocus = 'format' | 'path'
type ExportDialogView = 'form' | 'overwrite'

type SlowQueriesExportDialogProps = {
  open: boolean
  document: SlowQueriesExportDocument
  onSuccess: (absolutePath: string) => void
  onCancel: () => void
}

const FORMAT_LABELS: Record<ExportFormat, string> = {
  json: 'JSON',
  csv: 'CSV',
  markdown: 'Markdown',
}

export function SlowQueriesExportDialog({
  open,
  document,
  onSuccess,
  onCancel,
}: SlowQueriesExportDialogProps) {
  const renderer = useRenderer()
  const theme = useTheme((s) => s.theme)
  const pushOverlayKeybindings = useFooter((s) => s.pushOverlayKeybindings)
  const popOverlayKeybindings = useFooter((s) => s.popOverlayKeybindings)
  const notEditing = whenNotEditing(renderer)

  const [format, setFormat] = useState<ExportFormat>('json')
  const [pathText, setPathText] = useState(() => defaultExportFilename('json'))
  const [pathEdited, setPathEdited] = useState(false)
  const [focus, setFocus] = useState<ExportDialogFocus>('format')
  const [view, setView] = useState<ExportDialogView>('form')
  const [errorMessage, setErrorMessage] = useState('')
  const [isWriting, setIsWriting] = useState(false)
  const [pendingAbsolutePath, setPendingAbsolutePath] = useState<string | null>(null)

  const inputRef = useRef<InputRenderable | null>(null)
  const formatRef = useRef(format)
  const pathTextRef = useRef(pathText)
  const pathEditedRef = useRef(pathEdited)
  const focusRef = useRef(focus)
  const viewRef = useRef(view)
  const isWritingRef = useRef(isWriting)
  const documentRef = useRef(document)
  const onSuccessRef = useRef(onSuccess)
  const onCancelRef = useRef(onCancel)
  const pendingAbsolutePathRef = useRef(pendingAbsolutePath)

  formatRef.current = format
  pathTextRef.current = pathText
  pathEditedRef.current = pathEdited
  focusRef.current = focus
  viewRef.current = view
  isWritingRef.current = isWriting
  documentRef.current = document
  onSuccessRef.current = onSuccess
  onCancelRef.current = onCancel
  pendingAbsolutePathRef.current = pendingAbsolutePath

  const resolvedAbsolutePath = resolveUserPath(pathText)

  useEffect(
    function resetExportDialogWhenOpened() {
      if (!open) {
        return
      }
      const initialFormat: ExportFormat = 'json'
      setFormat(initialFormat)
      setPathText(defaultExportFilename(initialFormat))
      setPathEdited(false)
      setFocus('format')
      setView('form')
      setErrorMessage('')
      setIsWriting(false)
      setPendingAbsolutePath(null)
    },
    [open],
  )

  useEffect(
    function syncExportDialogFooter() {
      if (!open) {
        return
      }
      const footerId =
        view === 'overwrite' ? 'slow-queries-export-overwrite' : 'slow-queries-export-dialog'
      const chips =
        view === 'overwrite'
          ? SLOW_QUERIES_EXPORT_OVERWRITE_FOOTER
          : SLOW_QUERIES_EXPORT_DIALOG_FOOTER
      pushOverlayKeybindings(footerId, chips)
      return function clearExportDialogFooter() {
        popOverlayKeybindings(footerId)
      }
    },
    [open, popOverlayKeybindings, pushOverlayKeybindings, view],
  )

  useEffect(
    function applyExportDialogFocus() {
      if (!open || view !== 'form') {
        return
      }
      if (focus === 'path') {
        inputRef.current?.focus()
        return
      }
      const focused = renderer.currentFocusedEditor
      if (focused != null && typeof focused.blur === 'function') {
        focused.blur()
      }
    },
    [focus, open, renderer, view],
  )

  useEffect(
    function blurInputAfterFormatPathSync() {
      if (!open || view !== 'form' || focus !== 'format') {
        return
      }
      // Extension sync updates the input value and can steal editor focus.
      const focused = renderer.currentFocusedEditor
      if (focused != null && typeof focused.blur === 'function') {
        focused.blur()
      }
    },
    [focus, open, pathText, renderer, view],
  )

  useBindings(
    function createExportDialogFormLayer() {
      return {
        appMode: 'palette' satisfies AppKeymapMode,
        enabled: function exportFormBindingsEnabled() {
          return open && viewRef.current === 'form' && !isWritingRef.current && notEditing()
        },
        priority: 50,
        commands: [
          {
            name: 'slow-queries.export-format-prev',
            run() {
              if (focusRef.current !== 'format') {
                return
              }
              cycleFormat(-1)
            },
          },
          {
            name: 'slow-queries.export-format-next',
            run() {
              if (focusRef.current !== 'format') {
                return
              }
              cycleFormat(1)
            },
          },
        ],
        bindings: [
          { key: 'left', cmd: 'slow-queries.export-format-prev' },
          { key: 'k', cmd: 'slow-queries.export-format-prev' },
          { key: 'right', cmd: 'slow-queries.export-format-next' },
          { key: 'j', cmd: 'slow-queries.export-format-next' },
        ],
      }
    },
    [notEditing, open],
  )

  useBindings(
    function createExportDialogConfirmLayer() {
      return {
        appMode: 'palette' satisfies AppKeymapMode,
        enabled: open && !isWriting,
        priority: 55,
        commands: [
          {
            name: 'slow-queries.export-focus-toggle',
            run() {
              if (viewRef.current !== 'form') {
                return
              }
              setFocus((current) => (current === 'format' ? 'path' : 'format'))
              setErrorMessage('')
            },
          },
          {
            name: 'slow-queries.export-confirm',
            run() {
              if (viewRef.current === 'overwrite') {
                void writeToPath(pendingAbsolutePathRef.current)
                return
              }
              void beginConfirm()
            },
          },
          {
            name: 'slow-queries.export-cancel',
            run() {
              if (viewRef.current === 'overwrite') {
                setView('form')
                setPendingAbsolutePath(null)
                setErrorMessage('')
                return
              }
              onCancelRef.current()
            },
          },
        ],
        bindings: [
          { key: 'tab', cmd: 'slow-queries.export-focus-toggle' },
          { key: 'return', cmd: 'slow-queries.export-confirm' },
          { key: 'enter', cmd: 'slow-queries.export-confirm' },
          { key: 'escape', cmd: 'slow-queries.export-cancel' },
        ],
      }
    },
    [isWriting, open],
  )

  function cycleFormat(delta: number) {
    const currentIndex = EXPORT_FORMATS.indexOf(formatRef.current)
    const nextIndex = (currentIndex + delta + EXPORT_FORMATS.length) % EXPORT_FORMATS.length
    const nextFormat = EXPORT_FORMATS[nextIndex]!
    setFormat(nextFormat)
    // Updating the path `value` can emit onInput; keep focus on Format and do not
    // treat extension sync as a user edit (see onPathInput).
    setPathText(syncPathExtension(pathTextRef.current, nextFormat, pathEditedRef.current))
    setFocus('format')
    setErrorMessage('')
  }

  async function beginConfirm() {
    const trimmed = pathTextRef.current.trim()
    if (trimmed === '') {
      setErrorMessage('path is empty')
      return
    }

    const absolutePath = resolveUserPath(trimmed)
    let kind: 'missing' | 'file' | 'directory'
    try {
      kind = await classifyPath(absolutePath)
    } catch (error) {
      setErrorMessage(mapWriteError(error))
      return
    }

    if (kind === 'directory') {
      setErrorMessage('path is a directory')
      return
    }

    if (kind === 'file') {
      // Exists-check then write is not atomic against a concurrent writer; acceptable for a
      // user-chosen path.
      setPendingAbsolutePath(absolutePath)
      setView('overwrite')
      setErrorMessage('')
      return
    }

    await writeToPath(absolutePath)
  }

  async function writeToPath(absolutePath: string | null) {
    if (absolutePath == null || absolutePath.trim() === '') {
      setErrorMessage('path is empty')
      return
    }

    setIsWriting(true)
    setErrorMessage('')
    try {
      const body = serializeSlowQueriesExport(documentRef.current, formatRef.current)
      await atomicWriteFile(absolutePath, body)
      onSuccessRef.current(absolutePath)
    } catch (error) {
      setView('form')
      setPendingAbsolutePath(null)
      setErrorMessage(mapWriteError(error))
    } finally {
      setIsWriting(false)
    }
  }

  if (!open) {
    return null
  }

  if (view === 'overwrite') {
    return (
      <Dialog open onClose={onCancel} width={64}>
        <box paddingLeft={2} paddingRight={2} paddingBottom={1} gap={1}>
          <text content="Overwrite existing file?" fg={theme.text} attributes={TextAttributes.BOLD} />
          <text content={displayText(pendingAbsolutePath ?? '')} fg={theme.textMuted} />
          {errorMessage !== '' ? <text content={displayText(errorMessage)} fg={theme.error} /> : null}
          <text
            content={displayText(isWriting ? 'writing…' : 'enter overwrite · esc back')}
            fg={theme.textMuted}
          />
        </box>
      </Dialog>
    )
  }

  return (
    <Dialog open onClose={onCancel} width={64}>
      <box paddingLeft={2} paddingRight={2} paddingBottom={1} gap={1}>
        <text content="Export slow query patterns" fg={theme.text} attributes={TextAttributes.BOLD} />

        <box flexDirection="row" gap={1}>
          <text
            content={displayText(focus === 'format' ? '● Format:' : '○ Format:')}
            fg={focus === 'format' ? theme.primary : theme.textMuted}
          />
          {EXPORT_FORMATS.map(function renderFormat(option) {
            const selected = option === format
            return (
              <text
                key={option}
                content={displayText(
                  `${selected ? '[' : ' '}${FORMAT_LABELS[option]}${selected ? ']' : ' '}`,
                )}
                fg={selected ? theme.primary : theme.textMuted}
              />
            )
          })}
        </box>

        <box flexDirection="row" gap={1} alignItems="center">
          <text
            content={displayText(focus === 'path' ? '● Path:' : '○ Path:')}
            fg={focus === 'path' ? theme.primary : theme.textMuted}
          />
          <input
            ref={inputRef}
            flexGrow={1}
            value={pathText}
            backgroundColor={theme.backgroundElement}
            focusedBackgroundColor={theme.backgroundElement}
            textColor={theme.text}
            focusedTextColor={theme.text}
            cursorColor={theme.primary}
            placeholderColor={theme.textMuted}
            onInput={function onPathInput(value: string) {
              setPathText(value)
              // Programmatic value updates (format→extension sync) also hit onInput.
              // Only treat real typing as an edit / focus move to Path.
              const inputFocused =
                inputRef.current != null && renderer.currentFocusedEditor === inputRef.current
              if (inputFocused) {
                setPathEdited(true)
                setFocus('path')
              }
              setErrorMessage('')
            }}
            onSubmit={function onPathSubmit() {
              void beginConfirm()
            }}
          />
        </box>

        <text content={displayText(`→ ${resolvedAbsolutePath}`)} fg={theme.textMuted} />
        {errorMessage !== '' ? <text content={displayText(errorMessage)} fg={theme.error} /> : null}
        <text
          content={displayText(
            isWriting
              ? 'writing…'
              : 'tab focus · ←→/jk format · enter export · esc cancel',
          )}
          fg={theme.textMuted}
        />
      </box>
    </Dialog>
  )
}

async function classifyPath(absolutePath: string): Promise<'missing' | 'file' | 'directory'> {
  try {
    const info = await stat(absolutePath)
    if (info.isDirectory()) {
      return 'directory'
    }
    return 'file'
  } catch (error) {
    if (isNotFound(error)) {
      return 'missing'
    }
    throw error
  }
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error != null &&
    'code' in error &&
    (error as { code?: string }).code === 'ENOENT'
  )
}
