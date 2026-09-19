import { basename } from 'node:path'
import { fg, InputRenderable, StyledText, TextAttributes } from '@opentui/core'
import { useBindings } from '@opentui/keymap/react'
import { useRenderer, useTerminalDimensions } from '@opentui/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  filterTailLines,
  LOG_CATEGORY_COMPONENTS,
  type LogCategoryComponent,
  type TailLogLine,
} from '../../../../log-tail'
import { displayText } from '../../../../lib/display-text'
import { type AppKeymapMode } from '../../../lib/keymap-mode'
import { whenNotEditing } from '../../../lib/when-not-editing'
import { LOGS_FOOTER, LOGS_SHORTCUTS, toBindings } from '../../../shortcuts'
import { useLogTailStore } from '../../../stores/log-tail'
import { useSession } from '../../../stores/session'
import { useTheme } from '../../../stores/theme'
import { type Theme } from '../../../theme'
import { useFooterKeybindings, useFooterStatus } from '../../footer-keybindings'

const CHROME_ROWS = 12

export function LogsTab() {
  const logPath = useSession((s) => s.logPath)
  const activate = useLogTailStore((s) => s.activate)
  const deactivate = useLogTailStore((s) => s.deactivate)

  useEffect(
    function syncLogTailLifecycle() {
      if (logPath == null) {
        return
      }
      activate(logPath)
      return function pauseLogTailOnLeave() {
        deactivate()
      }
    },
    [logPath, activate, deactivate],
  )

  if (logPath == null) {
    return <LogsEmptyState />
  }

  return <LogsView logPath={logPath} />
}

function LogsEmptyState() {
  const theme = useTheme((s) => s.theme)
  return (
    <box flexGrow={1} paddingLeft={1} paddingTop={1}>
      <text content="No log file selected." fg={theme.textMuted} />
    </box>
  )
}

type LogsViewProps = {
  logPath: string
}

function LogsView({ logPath }: LogsViewProps) {
  const renderer = useRenderer()
  const theme = useTheme((s) => s.theme)
  const { height: terminalHeight } = useTerminalDimensions()
  const notEditing = whenNotEditing(renderer)

  const lines = useLogTailStore((s) => s.lines)
  const stats = useLogTailStore((s) => s.stats)
  const error = useLogTailStore((s) => s.error)
  const following = useLogTailStore((s) => s.following)
  const enabledCategories = useLogTailStore((s) => s.enabledCategories)
  const customFilter = useLogTailStore((s) => s.customFilter)
  const customFilterText = useLogTailStore((s) => s.customFilterText)
  const customFilterError = useLogTailStore((s) => s.customFilterError)
  const search = useLogTailStore((s) => s.search)
  const searchEditing = useLogTailStore((s) => s.searchEditing)
  const filterEditing = useLogTailStore((s) => s.filterEditing)

  const setFollowing = useLogTailStore((s) => s.setFollowing)
  const toggleCategory = useLogTailStore((s) => s.toggleCategory)
  const setSearch = useLogTailStore((s) => s.setSearch)
  const setSearchEditing = useLogTailStore((s) => s.setSearchEditing)
  const setCustomFilterText = useLogTailStore((s) => s.setCustomFilterText)
  const applyCustomFilter = useLogTailStore((s) => s.applyCustomFilter)
  const setFilterEditing = useLogTailStore((s) => s.setFilterEditing)

  const filtered = useMemo(
    function computeFilteredLines() {
      return filterTailLines(lines, {
        enabledCategories,
        customFilter,
        search,
      })
    },
    [lines, enabledCategories, customFilter, search],
  )

  const displayLines = useMemo(
    function reverseForNewestFirst() {
      const copy = filtered.slice()
      copy.reverse()
      return copy
    },
    [filtered],
  )

  const capacity = Math.max(1, terminalHeight - CHROME_ROWS)
  const [scrollOffset, setScrollOffset] = useState(0)
  const scrollOffsetRef = useRef(0)
  const capacityRef = useRef(capacity)
  const displayLenRef = useRef(displayLines.length)
  const followingRef = useRef(following)
  const toggleCategoryRef = useRef(toggleCategory)
  const setFollowingRef = useRef(setFollowing)
  const setSearchEditingRef = useRef(setSearchEditing)
  const setFilterEditingRef = useRef(setFilterEditing)

  scrollOffsetRef.current = scrollOffset
  capacityRef.current = capacity
  displayLenRef.current = displayLines.length
  followingRef.current = following
  toggleCategoryRef.current = toggleCategory
  setFollowingRef.current = setFollowing
  setSearchEditingRef.current = setSearchEditing
  setFilterEditingRef.current = setFilterEditing

  useEffect(
    function pinScrollWhenFollowing() {
      if (following) {
        setScrollOffset(0)
      }
    },
    [following, displayLines.length],
  )

  useEffect(
    function clampScrollOffset() {
      const maxOffset = Math.max(0, displayLines.length - capacity)
      if (scrollOffset > maxOffset) {
        setScrollOffset(maxOffset)
      }
    },
    [displayLines.length, capacity, scrollOffset],
  )

  const searchInputRef = useRef<InputRenderable | null>(null)
  const filterInputRef = useRef<InputRenderable | null>(null)

  useEffect(
    function focusSearchInput() {
      if (searchEditing) {
        searchInputRef.current?.focus()
      }
    },
    [searchEditing],
  )

  useEffect(
    function focusFilterInput() {
      if (filterEditing) {
        filterInputRef.current?.focus()
      }
    },
    [filterEditing],
  )

  const statusLabel = following
    ? `tailing · ${stats.bufferedCount} lines buffered`
    : `paused · ${stats.bufferedCount} lines buffered`
  useFooterStatus(error != null ? error : statusLabel)
  useFooterKeybindings(LOGS_FOOTER)

  useBindings(
    function createLogsLayer() {
      function moveScroll(delta: number) {
        if (followingRef.current) {
          setFollowingRef.current(false)
        }
        const maxOffset = Math.max(0, displayLenRef.current - capacityRef.current)
        setScrollOffset((prev) => Math.max(0, Math.min(maxOffset, prev + delta)))
      }

      return {
        appMode: 'base' satisfies AppKeymapMode,
        enabled: function logsBindingsEnabled() {
          return notEditing()
        },
        commands: [
          {
            name: 'logs.move-up',
            run() {
              moveScroll(-1)
            },
          },
          {
            name: 'logs.move-down',
            run() {
              moveScroll(1)
            },
          },
          {
            name: 'logs.toggle-follow',
            run() {
              const next = !followingRef.current
              setFollowingRef.current(next)
              if (next) {
                setScrollOffset(0)
              }
            },
          },
          {
            name: 'logs.open-search',
            run() {
              setSearchEditingRef.current(true)
            },
          },
          {
            name: 'logs.open-filter',
            run() {
              setFilterEditingRef.current(true)
            },
          },
          {
            name: 'logs.toggle-COMMAND',
            run() {
              toggleCategoryRef.current('COMMAND')
            },
          },
          {
            name: 'logs.toggle-WRITE',
            run() {
              toggleCategoryRef.current('WRITE')
            },
          },
          {
            name: 'logs.toggle-REPL',
            run() {
              toggleCategoryRef.current('REPL')
            },
          },
          {
            name: 'logs.toggle-NETWORK',
            run() {
              toggleCategoryRef.current('NETWORK')
            },
          },
          {
            name: 'logs.toggle-STORAGE',
            run() {
              toggleCategoryRef.current('STORAGE')
            },
          },
        ],
        bindings: toBindings(LOGS_SHORTCUTS),
      }
    },
    [notEditing],
  )

  const visible = displayLines.slice(scrollOffset, scrollOffset + capacity)
  const fileName = basename(logPath)

  return (
    <box flexGrow={1} flexShrink={1} flexDirection="column" paddingLeft={1} paddingRight={1}>
      <box flexDirection="row" justifyContent="space-between" flexShrink={0}>
        <text content={displayText(fileName)} fg={theme.text} attributes={TextAttributes.BOLD} />
        <text content={statusLabel} fg={theme.textMuted} />
      </box>

      <box flexDirection="row" gap={1} flexShrink={0} flexWrap="wrap" paddingTop={1}>
        {LOG_CATEGORY_COMPONENTS.map((component) => (
          <CategoryPill
            key={component}
            component={component}
            active={enabledCategories.has(component)}
            theme={theme}
          />
        ))}
        {customFilter != null ? (
          <box backgroundColor={theme.error} paddingLeft={1} paddingRight={1}>
            <text
              content={displayText(
                `${customFilter.field}${customFilter.operator}${customFilter.value}`,
              )}
              fg={theme.selectedListItemText}
            />
          </box>
        ) : null}
        {customFilterError != null ? (
          <text content={displayText(`filter: ${customFilterError}`)} fg={theme.error} />
        ) : null}
        <box flexGrow={1} />
        {searchEditing ? (
          <input
            ref={searchInputRef}
            width={24}
            value={search}
            placeholder="/ search"
            backgroundColor={theme.backgroundElement}
            focusedBackgroundColor={theme.backgroundElement}
            textColor={theme.text}
            focusedTextColor={theme.text}
            cursorColor={theme.primary}
            placeholderColor={theme.textMuted}
            onInput={setSearch}
            onSubmit={function commitSearch() {
              setSearchEditing(false)
            }}
          />
        ) : (
          <text
            content={search.length > 0 ? `/ ${search}` : '/ search'}
            fg={search.length > 0 ? theme.warning : theme.textMuted}
          />
        )}
      </box>

      {filterEditing ? (
        <box flexDirection="row" gap={1} paddingTop={1} flexShrink={0}>
          <text content="filter:" fg={theme.textMuted} />
          <input
            ref={filterInputRef}
            flexGrow={1}
            value={customFilterText}
            placeholder="durationMillis>100"
            backgroundColor={theme.backgroundElement}
            focusedBackgroundColor={theme.backgroundElement}
            textColor={theme.text}
            focusedTextColor={theme.text}
            cursorColor={theme.primary}
            placeholderColor={theme.textMuted}
            onInput={setCustomFilterText}
            onSubmit={function commitFilter() {
              applyCustomFilter()
            }}
          />
        </box>
      ) : null}

      <box flexGrow={1} flexShrink={1} flexDirection="column" paddingTop={1} overflow="hidden">
        {visible.length === 0 ? (
          <text content="no matching log lines" fg={theme.textMuted} />
        ) : (
          visible.map((line, index) => (
            <text
              key={`${scrollOffset + index}-${line.timestamp}-${line.id}-${line.msg}`}
              content={buildLogLineContent(line, search, theme)}
              wrapMode="none"
            />
          ))
        )}
      </box>

      <box
        flexShrink={0}
        borderStyle="single"
        borderColor={theme.borderSubtle}
        paddingLeft={1}
        paddingRight={1}
        marginTop={1}
        flexDirection="row"
        justifyContent="space-between"
      >
        <text content={`parser status  format: ${stats.format}`} fg={theme.textMuted} />
        <text content={`lines/sec: ~${stats.linesPerSec}`} fg={theme.textMuted} />
        <text content={`restarts detected: ${stats.restartsDetected}`} fg={theme.textMuted} />
      </box>
    </box>
  )
}

type CategoryPillProps = {
  component: LogCategoryComponent
  active: boolean
  theme: Theme
}

function CategoryPill({ component, active, theme }: CategoryPillProps) {
  return (
    <box
      backgroundColor={active ? theme.info : theme.backgroundElement}
      paddingLeft={1}
      paddingRight={1}
    >
      <text
        content={component}
        fg={active ? theme.selectedListItemText : theme.textMuted}
        attributes={active ? TextAttributes.BOLD : undefined}
      />
    </box>
  )
}

function buildLogLineContent(line: TailLogLine, search: string, theme: Theme): StyledText {
  const chunks = []
  const time = formatLogTimestamp(line.timestamp)
  chunks.push(fg(theme.textMuted)(`${time} `))

  const sev = line.severityLabel || '?'
  chunks.push(fg(severityFg(sev, theme))(`${sev} `))

  const component = (line.component || 'RAW').padEnd(8)
  chunks.push(fg(severityFg(sev, theme))(`${component} `))

  const body = buildBodyText(line)
  chunks.push(...colorizeBody(body, line, search, theme))

  return new StyledText(chunks)
}

function buildBodyText(line: TailLogLine): string {
  if (line.kind === 'raw') {
    return line.msg
  }
  const parts: string[] = [line.msg]
  if (line.namespace != null) {
    parts.push(`ns=${line.namespace}`)
  }
  if (line.planSummary != null) {
    parts.push(`planSummary: ${line.planSummary}`)
  }
  if (line.durationMillis != null) {
    parts.push(`durationMillis: ${line.durationMillis}`)
  }
  return parts.join(' ')
}

function colorizeBody(body: string, line: TailLogLine, search: string, theme: Theme) {
  const highlights: Array<{ start: number; end: number; color: Theme['text'] }> = []

  function addValue(value: string | null | number, color: Theme['text']): void {
    if (value == null) {
      return
    }
    const text = String(value)
    if (text.length === 0) {
      return
    }
    let from = 0
    while (from < body.length) {
      const idx = body.indexOf(text, from)
      if (idx < 0) {
        break
      }
      highlights.push({ start: idx, end: idx + text.length, color })
      from = idx + text.length
    }
  }

  addValue(line.namespace, theme.warning)
  addValue(line.planSummary, theme.accent)
  if (line.durationMillis != null) {
    addValue(String(line.durationMillis), theme.error)
  }

  const needle = search.trim()
  if (needle.length > 0) {
    const lowerBody = body.toLowerCase()
    const lowerNeedle = needle.toLowerCase()
    let from = 0
    while (from < body.length) {
      const idx = lowerBody.indexOf(lowerNeedle, from)
      if (idx < 0) {
        break
      }
      highlights.push({ start: idx, end: idx + needle.length, color: theme.warning })
      from = idx + needle.length
    }
  }

  if (highlights.length === 0) {
    return [fg(theme.text)(body)]
  }

  highlights.sort((a, b) => a.start - b.start || b.end - a.end)
  const merged: typeof highlights = []
  for (const h of highlights) {
    const last = merged[merged.length - 1]
    if (last && h.start < last.end) {
      if (h.end > last.end) {
        last.end = h.end
      }
      continue
    }
    merged.push({ ...h })
  }

  const out = []
  let cursor = 0
  for (const h of merged) {
    if (h.start > cursor) {
      out.push(fg(theme.text)(body.slice(cursor, h.start)))
    }
    out.push(fg(h.color)(body.slice(h.start, h.end)))
    cursor = h.end
  }
  if (cursor < body.length) {
    out.push(fg(theme.text)(body.slice(cursor)))
  }
  return out
}

function severityFg(sev: string, theme: Theme): Theme['text'] {
  switch (sev) {
    case 'F':
    case 'E':
      return theme.error
    case 'W':
      return theme.warning
    case 'I':
      return theme.info
    default:
      return theme.textMuted
  }
}

function formatLogTimestamp(ms: number): string {
  if (!Number.isFinite(ms)) {
    return '--:--:--.---'
  }
  const d = new Date(ms)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  const mss = String(d.getMilliseconds()).padStart(3, '0')
  return `${hh}:${mm}:${ss}.${mss}`
}
