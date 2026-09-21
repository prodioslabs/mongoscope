import { InputRenderable, TextAttributes } from '@opentui/core'
import { useBindings } from '@opentui/keymap/react'
import { useRenderer } from '@opentui/react'
import { useEffect, useRef, useState } from 'react'
import { formatLogTailPreset, parseLogTailLinesInput } from '../../../../parser'
import { displayText } from '../../../../lib/display-text'
import { type AppKeymapMode } from '../../../lib/keymap-mode'
import { whenNotEditing } from '../../../lib/when-not-editing'
import { SLOW_QUERIES_TAIL_DIALOG_FOOTER } from '../../../shortcuts/slow-queries'
import { useFooter } from '../../../stores/footer'
import { useTheme } from '../../../stores/theme'
import { Dialog } from '../../ui/dialog'

type LogTailDialogProps = {
  open: boolean
  title: string
  subtitle: string
  currentLines: number
  presets: readonly number[]
  maxLines: number
  isPending: boolean
  onApply: (lines: number) => void
  onCancel: () => void
}

export function LogTailDialog({
  open,
  title,
  subtitle,
  currentLines,
  presets,
  maxLines,
  isPending,
  onApply,
  onCancel,
}: LogTailDialogProps) {
  const renderer = useRenderer()
  const theme = useTheme((s) => s.theme)
  const pushOverlayKeybindings = useFooter((s) => s.pushOverlayKeybindings)
  const popOverlayKeybindings = useFooter((s) => s.popOverlayKeybindings)
  const notEditing = whenNotEditing(renderer)

  const customRowIndex = presets.length
  const presetIndex = presets.indexOf(currentLines)
  const [selectedIndex, setSelectedIndex] = useState(
    presetIndex >= 0 ? presetIndex : customRowIndex,
  )
  const [customText, setCustomText] = useState(presetIndex >= 0 ? '' : String(currentLines))
  const [customError, setCustomError] = useState<string | null>(null)

  const selectedIndexRef = useRef(selectedIndex)
  const customTextRef = useRef(customText)
  const inputRef = useRef<InputRenderable | null>(null)
  const onApplyRef = useRef(onApply)
  const onCancelRef = useRef(onCancel)
  const presetsRef = useRef(presets)
  const customRowIndexRef = useRef(customRowIndex)

  selectedIndexRef.current = selectedIndex
  customTextRef.current = customText
  onApplyRef.current = onApply
  onCancelRef.current = onCancel
  presetsRef.current = presets
  customRowIndexRef.current = customRowIndex

  useEffect(
    function resetDialogStateWhenOpened() {
      if (!open) {
        return
      }
      const index = presets.indexOf(currentLines)
      setSelectedIndex(index >= 0 ? index : customRowIndex)
      setCustomText(index >= 0 ? '' : String(currentLines))
      setCustomError(null)
    },
    [currentLines, customRowIndex, open, presets],
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
        if (parsed == null || parsed > maxLines) {
          setCustomError(
            `enter 1–${formatLogTailPreset(maxLines)} (e.g. 75000 or 75k)`,
          )
          setSelectedIndex(customRowIndexRef.current)
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
        const currentPresets = presetsRef.current
        if (index < currentPresets.length) {
          onApplyRef.current(currentPresets[index]!)
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
              setSelectedIndex((prev) => Math.min(customRowIndexRef.current, prev + 1))
              setCustomError(null)
            },
          },
          {
            name: 'slow-queries.tail-edit-custom',
            run() {
              setSelectedIndex(customRowIndexRef.current)
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
    [isPending, maxLines, notEditing, open],
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
    <Dialog open onClose={onCancel} width={52}>
      <box paddingLeft={2} paddingRight={2} paddingBottom={1} gap={1}>
        <text content={title} fg={theme.text} attributes={TextAttributes.BOLD} />
        <text content={displayText(subtitle)} fg={theme.textMuted} />
        <text
          content={displayText(`current: ${formatLogTailPreset(currentLines)}`)}
          fg={theme.textMuted}
        />

        {presets.map((preset, index) => {
          const selected = selectedIndex === index
          return (
            <text
              key={preset}
              content={displayText(
                `${selected ? '●' : '○'} ${formatLogTailPreset(preset)} docs`,
              )}
              fg={selected ? theme.primary : theme.text}
            />
          )
        })}

        <box flexDirection="row" gap={1} alignItems="center">
          <text
            content={displayText(`${selectedIndex === customRowIndex ? '●' : '○'} Custom:`)}
            fg={selectedIndex === customRowIndex ? theme.primary : theme.text}
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
              setSelectedIndex(customRowIndex)
            }}
            onSubmit={function submitCustomTail() {
              const parsed = parseLogTailLinesInput(customTextRef.current)
              if (parsed == null || parsed > maxLines) {
                setCustomError(
                  `enter 1–${formatLogTailPreset(maxLines)} (e.g. 75000 or 75k)`,
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
              ? 'updating…'
              : '↑↓ navigate · enter apply · i custom · esc cancel'
          }
          fg={theme.textMuted}
        />
      </box>
    </Dialog>
  )
}
