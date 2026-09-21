import { InputRenderable, TextAttributes } from '@opentui/core'
import { useBindings } from '@opentui/keymap/react'
import { useRenderer } from '@opentui/react'
import { useEffect, useRef, useState } from 'react'
import {
  LOG_TAIL_LINE_PRESETS,
  MAX_LOG_TAIL_LINES,
  formatLogTailPreset,
  parseLogTailLinesInput,
} from '../../../../parser'
import { displayText } from '../../../../lib/display-text'
import { type AppKeymapMode } from '../../../lib/keymap-mode'
import { whenNotEditing } from '../../../lib/when-not-editing'
import { SLOW_QUERIES_TAIL_DIALOG_FOOTER } from '../../../shortcuts/slow-queries'
import { useFooter } from '../../../stores/footer'
import { useTheme } from '../../../stores/theme'
import { Dialog } from '../../ui/dialog'

const CUSTOM_ROW_INDEX = LOG_TAIL_LINE_PRESETS.length

type LogTailDialogProps = {
  open: boolean
  currentLines: number
  isPending: boolean
  onApply: (lines: number) => void
  onCancel: () => void
}

export function LogTailDialog({
  open,
  currentLines,
  isPending,
  onApply,
  onCancel,
}: LogTailDialogProps) {
  const renderer = useRenderer()
  const theme = useTheme((s) => s.theme)
  const pushOverlayKeybindings = useFooter((s) => s.pushOverlayKeybindings)
  const popOverlayKeybindings = useFooter((s) => s.popOverlayKeybindings)
  const notEditing = whenNotEditing(renderer)

  const presetIndex = LOG_TAIL_LINE_PRESETS.indexOf(
    currentLines as (typeof LOG_TAIL_LINE_PRESETS)[number],
  )
  const [selectedIndex, setSelectedIndex] = useState(
    presetIndex >= 0 ? presetIndex : CUSTOM_ROW_INDEX,
  )
  const [customText, setCustomText] = useState(presetIndex >= 0 ? '' : String(currentLines))
  const [customError, setCustomError] = useState<string | null>(null)

  const selectedIndexRef = useRef(selectedIndex)
  const customTextRef = useRef(customText)
  const inputRef = useRef<InputRenderable | null>(null)
  const onApplyRef = useRef(onApply)
  const onCancelRef = useRef(onCancel)

  selectedIndexRef.current = selectedIndex
  customTextRef.current = customText
  onApplyRef.current = onApply
  onCancelRef.current = onCancel

  useEffect(
    function resetDialogStateWhenOpened() {
      if (!open) {
        return
      }
      const index = LOG_TAIL_LINE_PRESETS.indexOf(
        currentLines as (typeof LOG_TAIL_LINE_PRESETS)[number],
      )
      setSelectedIndex(index >= 0 ? index : CUSTOM_ROW_INDEX)
      setCustomText(index >= 0 ? '' : String(currentLines))
      setCustomError(null)
    },
    [currentLines, open],
  )

  useEffect(
    function syncTailDialogFooter() {
      if (!open) {
        return
      }
      pushOverlayKeybindings('log-tail-dialog', SLOW_QUERIES_TAIL_DIALOG_FOOTER)
      return function clearTailDialogFooter() {
        popOverlayKeybindings('log-tail-dialog')
      }
    },
    [open, popOverlayKeybindings, pushOverlayKeybindings],
  )

  useBindings(
    function createLogTailDialogLayer() {
      function applyCustomOrShowError(): boolean {
        const parsed = parseLogTailLinesInput(customTextRef.current)
        if (parsed == null) {
          setCustomError(
            `enter 1–${formatLogTailPreset(MAX_LOG_TAIL_LINES)} lines (e.g. 75000 or 75k)`,
          )
          setSelectedIndex(CUSTOM_ROW_INDEX)
          inputRef.current?.focus()
          return false
        }
        setCustomError(null)
        onApplyRef.current(parsed)
        return true
      }

      function applySelection() {
        if (isPending) {
          return
        }
        const index = selectedIndexRef.current
        if (index < LOG_TAIL_LINE_PRESETS.length) {
          onApplyRef.current(LOG_TAIL_LINE_PRESETS[index]!)
          return
        }
        applyCustomOrShowError()
      }

      return {
        appMode: 'palette' satisfies AppKeymapMode,
        enabled: function logTailDialogBindingsEnabled() {
          return open && !isPending && notEditing()
        },
        priority: 50,
        commands: [
          {
            name: 'slow-queries.tail-move-up',
            run() {
              setSelectedIndex((prev) => Math.max(0, prev - 1))
              setCustomError(null)
            },
          },
          {
            name: 'slow-queries.tail-move-down',
            run() {
              setSelectedIndex((prev) => Math.min(CUSTOM_ROW_INDEX, prev + 1))
              setCustomError(null)
            },
          },
          {
            name: 'slow-queries.tail-edit-custom',
            run() {
              setSelectedIndex(CUSTOM_ROW_INDEX)
              setCustomError(null)
              inputRef.current?.focus()
            },
          },
          {
            name: 'slow-queries.tail-apply',
            run() {
              applySelection()
            },
          },
          {
            name: 'slow-queries.tail-cancel',
            run() {
              onCancelRef.current()
            },
          },
        ],
        bindings: [
          { key: 'up', cmd: 'slow-queries.tail-move-up' },
          { key: 'k', cmd: 'slow-queries.tail-move-up' },
          { key: 'down', cmd: 'slow-queries.tail-move-down' },
          { key: 'j', cmd: 'slow-queries.tail-move-down' },
          { key: 'i', cmd: 'slow-queries.tail-edit-custom' },
          { key: 'return', cmd: 'slow-queries.tail-apply' },
          { key: 'enter', cmd: 'slow-queries.tail-apply' },
          { key: 'escape', cmd: 'slow-queries.tail-cancel' },
        ],
      }
    },
    [isPending, notEditing, open],
  )

  useBindings(
    function createLogTailDialogEditingLayer() {
      return {
        appMode: 'palette' satisfies AppKeymapMode,
        enabled: function logTailEditingBindingsEnabled() {
          return open && !isPending && !notEditing()
        },
        priority: 55,
        commands: [
          {
            name: 'slow-queries.tail-blur-custom',
            run() {
              const focused = renderer.currentFocusedEditor
              if (focused != null && typeof focused.blur === 'function') {
                focused.blur()
              }
              setCustomError(null)
            },
          },
        ],
        bindings: [{ key: 'escape', cmd: 'slow-queries.tail-blur-custom' }],
      }
    },
    [isPending, notEditing, open, renderer],
  )

  if (!open) {
    return null
  }

  return (
    <Dialog open onClose={onCancel} width={48}>
      <box paddingLeft={2} paddingRight={2} paddingBottom={1} gap={1}>
        <text content="Log tail window" fg={theme.text} attributes={TextAttributes.BOLD} />
        <text
          content={displayText(`current: ${formatLogTailPreset(currentLines)} lines`)}
          fg={theme.textMuted}
        />

        {LOG_TAIL_LINE_PRESETS.map((preset, index) => {
          const selected = selectedIndex === index
          return (
            <text
              key={preset}
              content={displayText(
                `${selected ? '●' : '○'} ${formatLogTailPreset(preset)} lines`,
              )}
              fg={selected ? theme.primary : theme.text}
            />
          )
        })}

        <box flexDirection="row" gap={1} alignItems="center">
          <text
            content={displayText(`${selectedIndex === CUSTOM_ROW_INDEX ? '●' : '○'} Custom:`)}
            fg={selectedIndex === CUSTOM_ROW_INDEX ? theme.primary : theme.text}
          />
          <input
            ref={inputRef}
            width={16}
            value={customText}
            placeholder="e.g. 75k"
            backgroundColor={theme.backgroundElement}
            focusedBackgroundColor={theme.backgroundElement}
            textColor={theme.text}
            focusedTextColor={theme.text}
            cursorColor={theme.primary}
            placeholderColor={theme.textMuted}
            onInput={function onCustomTailInput(value: string) {
              setCustomText(value)
              setCustomError(null)
              setSelectedIndex(CUSTOM_ROW_INDEX)
            }}
            onSubmit={function submitCustomTail() {
              const parsed = parseLogTailLinesInput(customTextRef.current)
              if (parsed == null) {
                setCustomError(
                  `enter 1–${formatLogTailPreset(MAX_LOG_TAIL_LINES)} lines (e.g. 75000 or 75k)`,
                )
                return
              }
              setCustomError(null)
              onApply(parsed)
            }}
          />
        </box>

        {customError != null ? <text content={displayText(customError)} fg={theme.error} /> : null}
        <text
          content={
            isPending
              ? 'reparsing…'
              : '↑↓ navigate · enter apply · i custom · esc cancel'
          }
          fg={theme.textMuted}
        />
      </box>
    </Dialog>
  )
}
