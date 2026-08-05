import { InputRenderable, RGBA, ScrollBoxRenderable, TextAttributes } from '@opentui/core'
import { useBindings } from '@opentui/keymap/react'
import { useRenderer, useTerminalDimensions } from '@opentui/react'
import { matchSorter } from 'match-sorter'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { type AppKeymapMode } from '../lib/keymap-mode'
import { useFooter, type FooterKeybinding } from '../stores/footer'
import { useTheme } from '../stores/theme'
import { selectedForeground } from '../theme'
import { Dialog } from './ui/dialog'

const PALETTE_OVERLAY_KEYBINDINGS: FooterKeybinding[] = [
  { keys: '↑/↓', label: 'navigate' },
  { keys: 'enter', label: 'select' },
  { keys: 'esc', label: 'close' },
]

type CommandPaletteProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type CommandOption = {
  title: string
  value: string
  description?: string
  category?: string
  footer?: ReactNode | string
  disabled?: boolean
}

type CommandOptionRowProps = {
  option: CommandOption
  active: boolean
  current: boolean
  onMouseMove: () => void
  onMouseOver: () => void
  onMouseDown: () => void
  onSelect: () => void
}

type PaletteView = 'commands' | 'themes'

function CommandOptionRow({
  option,
  active,
  current,
  onMouseMove,
  onMouseOver,
  onMouseDown,
  onSelect,
}: CommandOptionRowProps) {
  const theme = useTheme((s) => s.theme)
  const fg = selectedForeground(theme)
  const textColor = active ? fg : current ? theme.primary : theme.text
  const mutedColor = active ? fg : theme.textMuted

  return (
    <box
      id={`command-option-${option.value}`}
      flexDirection="column"
      onMouseMove={onMouseMove}
      onMouseOver={onMouseOver}
      onMouseDown={onMouseDown}
      onMouseUp={onSelect}
    >
      <box
        flexDirection="row"
        paddingLeft={current ? 1 : 3}
        paddingRight={3}
        gap={1}
        backgroundColor={active ? theme.primary : RGBA.fromInts(0, 0, 0, 0)}
      >
        {current ? (
          <text flexShrink={0} fg={textColor} marginRight={0}>
            ●
          </text>
        ) : null}
        <text
          flexGrow={1}
          fg={textColor}
          attributes={active ? TextAttributes.BOLD : undefined}
          overflow="hidden"
          wrapMode="none"
        >
          {option.title}
          {option.description ? (
            <span style={{ fg: mutedColor }}> {option.description}</span>
          ) : null}
        </text>
        {option.footer != null ? (
          <box flexShrink={0}>
            <text fg={mutedColor}>{option.footer}</text>
          </box>
        ) : null}
      </box>
    </box>
  )
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const renderer = useRenderer()
  const dimensions = useTerminalDimensions()
  const theme = useTheme((s) => s.theme)
  const mode = useTheme((s) => s.mode)
  const selectedTheme = useTheme((s) => s.selected)
  const all = useTheme((s) => s.all)
  const setMode = useTheme((s) => s.setMode)
  const set = useTheme((s) => s.set)
  const setOverlayKeybindings = useFooter((s) => s.setOverlayKeybindings)

  const [view, setView] = useState<PaletteView>('commands')
  const [filter, setFilter] = useState('')
  const [selected, setSelected] = useState(0)
  const [inputMode, setInputMode] = useState<'keyboard' | 'mouse'>('keyboard')

  const scrollRef = useRef<ScrollBoxRenderable | null>(null)
  const inputRef = useRef<InputRenderable | null>(null)
  const flatRef = useRef<CommandOption[]>([])
  const selectedRef = useRef(0)
  const viewRef = useRef(view)
  const onOpenChangeRef = useRef(onOpenChange)

  const commandOptions = useMemo(
    (): CommandOption[] => [
      {
        title: 'Quit',
        value: 'quit',
        category: 'App',
        footer: 'q',
      },
      {
        title: 'Toggle mode',
        value: 'toggle-mode',
        category: 'Theme',
        footer: 'm',
      },
      {
        title: 'Switch theme',
        value: 'switch-theme',
        category: 'Theme',
      },
    ],
    [],
  )

  const themeOptions = useMemo(
    (): CommandOption[] =>
      Object.keys(all()).map((name) => ({
        title: name,
        value: name,
        category: 'Themes',
      })),
    [all],
  )

  const baseOptions = view === 'themes' ? themeOptions : commandOptions

  const enabledOptions = useMemo(
    () => baseOptions.filter((option) => option.disabled !== true),
    [baseOptions],
  )

  const filtered = useMemo(() => {
    if (!filter) return enabledOptions
    return matchSorter(enabledOptions, filter, {
      keys: ['title', 'category'],
    })
  }, [enabledOptions, filter])

  const grouped = useMemo(() => {
    const groups = Object.groupBy(filtered, (option) => option.category ?? '')
    return Object.entries(groups) as [string, CommandOption[]][]
  }, [filtered])

  const flat = useMemo(() => grouped.flatMap(([, groupOptions]) => groupOptions), [grouped])

  flatRef.current = flat
  selectedRef.current = selected
  viewRef.current = view
  onOpenChangeRef.current = onOpenChange

  const rows = useMemo(() => {
    const headers = grouped.reduce((acc, [category], index) => {
      if (!category) return acc
      return acc + (index > 0 ? 2 : 1)
    }, 0)
    return flat.length + headers
  }, [flat.length, grouped])

  const height = Math.min(rows, Math.floor(dimensions.height / 2) - 6)
  const currentValue = view === 'themes' ? selectedTheme : undefined
  const title = view === 'themes' ? 'Themes' : 'Commands'
  const placeholder = view === 'themes' ? 'Search themes' : 'Search commands'

  useEffect(
    function resetPaletteWhenClosed() {
      if (open) return
      setView('commands')
      setFilter('')
      setSelected(0)
      setInputMode('keyboard')
    },
    [open],
  )

  useEffect(
    function syncFooterOverlayKeybindings() {
      if (!open) return
      setOverlayKeybindings(PALETTE_OVERLAY_KEYBINDINGS)
      return function clearFooterOverlayKeybindings() {
        setOverlayKeybindings(null)
      }
    },
    [open, setOverlayKeybindings],
  )

  useEffect(
    function resetSelectionOnFilterOrViewChange() {
      setSelected(0)
      setInputMode('keyboard')
    },
    [filter, view],
  )

  useEffect(
    function clampSelectionToFiltered() {
      if (flat.length === 0) {
        setSelected(0)
        return
      }
      setSelected((index) => Math.min(index, flat.length - 1))
    },
    [flat.length],
  )

  useEffect(
    function focusFilterInput() {
      if (!open) return
      const timer = setTimeout(() => {
        const input = inputRef.current
        if (!input || input.isDestroyed) return
        input.focus()
      }, 1)
      return () => clearTimeout(timer)
    },
    [open, view],
  )

  useEffect(
    function scrollSelectedIntoView() {
      const scroll = scrollRef.current
      const option = flat[selected]
      if (!scroll || !option) return
      scroll.scrollChildIntoView(`command-option-${option.value}`)
    },
    [flat, selected],
  )

  function handleClose() {
    if (viewRef.current === 'themes') {
      setView('commands')
      setFilter('')
      return
    }
    onOpenChangeRef.current(false)
  }

  function runCommand(value: string) {
    if (value === 'switch-theme') {
      setView('themes')
      setFilter('')
      return
    }

    onOpenChange(false)

    if (view === 'themes') {
      set(value)
      return
    }

    if (value === 'quit') {
      renderer.destroy()
      return
    }

    if (value === 'toggle-mode') {
      setMode(mode === 'dark' ? 'light' : 'dark')
    }
  }

  function submitCurrent() {
    const option = flatRef.current[selectedRef.current]
    if (!option) return
    runCommand(option.value)
  }

  const submitCurrentRef = useRef(submitCurrent)
  submitCurrentRef.current = submitCurrent

  useBindings(function createCommandPaletteLayer() {
    return {
      appMode: 'palette' satisfies AppKeymapMode,
      commands: [
        {
          name: 'palette.navigate-up',
          run() {
            const items = flatRef.current
            if (items.length === 0) return
            setInputMode('keyboard')
            setSelected((index) => (index - 1 + items.length) % items.length)
          },
        },
        {
          name: 'palette.navigate-down',
          run() {
            const items = flatRef.current
            if (items.length === 0) return
            setInputMode('keyboard')
            setSelected((index) => (index + 1) % items.length)
          },
        },
        {
          name: 'palette.submit',
          run() {
            submitCurrentRef.current()
          },
        },
      ],
      bindings: [
        { key: 'up', cmd: 'palette.navigate-up' },
        { key: 'down', cmd: 'palette.navigate-down' },
        { key: 'return', cmd: 'palette.submit' },
        { key: 'enter', cmd: 'palette.submit' },
      ],
    }
  }, [])

  return (
    <Dialog open={open} onClose={handleClose}>
      <box gap={1} paddingBottom={1} flexGrow={1}>
        <box paddingLeft={4} paddingRight={4}>
          <box flexDirection="row" justifyContent="space-between">
            <text fg={theme.text} attributes={TextAttributes.BOLD}>
              {title}
            </text>
            <text fg={theme.textMuted} onMouseUp={handleClose}>
              esc
            </text>
          </box>
          <box paddingTop={1}>
            <input
              ref={inputRef}
              focused
              value={filter}
              onInput={setFilter}
              onSubmit={submitCurrent}
              focusedBackgroundColor={theme.backgroundPanel}
              cursorColor={theme.primary}
              focusedTextColor={theme.textMuted}
              placeholder={placeholder}
              placeholderColor={theme.textMuted}
            />
          </box>
        </box>
        <box flexGrow={1} flexShrink={1}>
          {grouped.length > 0 ? (
            <scrollbox
              ref={scrollRef}
              paddingLeft={1}
              paddingRight={1}
              scrollbarOptions={{ visible: false }}
              maxHeight={Math.max(height, 1)}
            >
              {grouped.map(([category, groupOptions], index) => (
                <box key={category || `group-${index}`} flexDirection="column">
                  {category ? (
                    <box paddingTop={index > 0 ? 1 : 0} paddingLeft={3}>
                      <text fg={theme.accent} attributes={TextAttributes.BOLD}>
                        {category}
                      </text>
                    </box>
                  ) : null}
                  {groupOptions.map((option) => {
                    const optionIndex = flat.findIndex((item) => item.value === option.value)
                    const active = optionIndex === selected
                    const isCurrent = currentValue !== undefined && option.value === currentValue

                    return (
                      <CommandOptionRow
                        key={`${category}:${option.value}`}
                        option={option}
                        active={active}
                        current={isCurrent}
                        onMouseMove={() => setInputMode('mouse')}
                        onMouseOver={() => {
                          if (inputMode !== 'mouse') return
                          if (optionIndex >= 0) setSelected(optionIndex)
                        }}
                        onMouseDown={() => {
                          setInputMode('mouse')
                          if (optionIndex >= 0) setSelected(optionIndex)
                        }}
                        onSelect={() => runCommand(option.value)}
                      />
                    )
                  })}
                </box>
              ))}
            </scrollbox>
          ) : (
            <box paddingLeft={4} paddingRight={4} paddingTop={1}>
              <text fg={theme.textMuted}>No results found</text>
            </box>
          )}
        </box>
        <box flexShrink={0} />
      </box>
    </Dialog>
  )
}
