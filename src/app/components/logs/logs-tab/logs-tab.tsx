import { basename } from 'node:path'
import {
  InputRenderable,
  TextAttributes,
  type TextChunk,
  type TextTableContent,
} from '@opentui/core'
import { useBindings } from '@opentui/keymap/react'
import { useRenderer, useTerminalDimensions } from '@opentui/react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  filterTailLines,
  LOG_CATEGORY_COMPONENTS,
  type LogCategoryComponent,
  type TailLogLine,
} from '../../../../log-tail'
import { displayText } from '../../../../lib/display-text'
import { truncateText } from '../../../../lib/truncate-text'
import { type AppKeymapMode } from '../../../lib/keymap-mode'
import {
  computeTableCapacity,
  headerCell,
  padTableRows,
  tableCell,
} from '../../../lib/text-table-content'
import { whenNotEditing } from '../../../lib/when-not-editing'
import { LOGS_FOOTER, LOGS_SHORTCUTS, toBindings } from '../../../shortcuts'
import { useLiveConnection } from '../../../stores/live-connection'
import { useLogTailStore } from '../../../stores/log-tail'
import { useSession } from '../../../stores/session'
import { useTheme } from '../../../stores/theme'
import { type Theme } from '../../../theme'
import { DataTextTable } from '../../data-text-table'
import { DbSelector } from '../../db-selector'
import { useFooterKeybindings, useFooterStatus } from '../../footer-keybindings'

/** Tab bar, title, pills, optional filter input, parser status, app footer. */
const LOGS_CHROME_ROWS_STATIC = 14
/** Extra rows for fidelity note + db selector chrome. */
const LOGS_CHROME_ROWS_LIVE = 16

const GET_LOG_FIDELITY_NOTE = 'getLog RAM buffer (~1024 events) — not a durable on-disk log'

export function LogsTab() {
  const theme = useTheme((s) => s.theme)
  const logPath = useSession((s) => s.logPath)
  const activeConnectionId = useSession((s) => s.activeConnectionId)
  const logsSource = useSession((s) => s.logsSource)
  const setLogsSource = useSession((s) => s.setLogsSource)

  const liveStatus = useLiveConnection((s) => s.status)
  const liveErrorMessage = useLiveConnection((s) => s.errorMessage)
  const connectionId = useLiveConnection((s) => s.connectionId)
  const generation = useLiveConnection((s) => s.generation)

  const activateFile = useLogTailStore((s) => s.activateFile)
  const activateLive = useLogTailStore((s) => s.activateLive)
  const deactivate = useLogTailStore((s) => s.deactivate)
  const teardown = useLogTailStore((s) => s.teardown)

  const useLive = logsSource === 'live' && activeConnectionId != null && liveStatus === 'connected'
  const showSourceToggle = activeConnectionId != null

  useBindings(
    function createLogsSourceLayer() {
      return {
        appMode: 'base' satisfies AppKeymapMode,
        enabled: showSourceToggle,
        priority: 5,
        commands: [
          {
            name: 'logs.toggle-source',
            run() {
              setLogsSource(logsSource === 'live' ? 'static' : 'live')
            },
          },
        ],
        bindings: [{ key: 'l', cmd: 'logs.toggle-source' }],
      }
    },
    [logsSource, setLogsSource, showSourceToggle],
  )

  useEffect(
    function syncLogIngestLifecycle() {
      if (logsSource === 'live') {
        if (useLive && connectionId != null) {
          const key = `${connectionId}:${generation}`
          activateLive(key)
          return function pauseLiveOnLeave() {
            deactivate()
          }
        }

        if (liveStatus === 'idle' || liveStatus === 'disconnected' || liveStatus === 'error') {
          teardown()
          return
        }

        deactivate()
        return
      }

      if (logPath != null) {
        activateFile(logPath)
        return function pauseFileOnLeave() {
          deactivate()
        }
      }

      deactivate()
      return undefined
    },
    [
      activateFile,
      activateLive,
      connectionId,
      deactivate,
      generation,
      liveStatus,
      logPath,
      logsSource,
      teardown,
      useLive,
    ],
  )

  let body: ReactNode
  if (useLive) {
    body = (
      <box flexGrow={1} flexShrink={1} flexDirection="column">
        <DbSelector />
        <LogsView mode="live" title="server log (getLog)" />
      </box>
    )
  } else if (logsSource === 'live' && activeConnectionId != null) {
    body = (
      <box flexGrow={1} flexShrink={1} flexDirection="column">
        <DbSelector />
        <box paddingLeft={1} paddingTop={1}>
          {liveStatus === 'connecting' ? (
            <text content="connecting…" fg={theme.textMuted} />
          ) : liveStatus === 'error' ? (
            <text
              content={displayText(liveErrorMessage || 'Connection failed.')}
              fg={theme.error}
            />
          ) : liveStatus === 'disconnected' ? (
            <text
              content="Connection lost. Press c and reselect a connection to retry."
              fg={theme.warning}
            />
          ) : (
            <text content="connecting…" fg={theme.textMuted} />
          )}
        </box>
      </box>
    )
  } else if (logPath == null) {
    body = <LogsEmptyState />
  } else {
    body = <LogsView mode="static" title={basename(logPath)} />
  }

  return (
    <box flexGrow={1} flexShrink={1} flexDirection="column">
      {showSourceToggle ? (
        <box paddingLeft={1} paddingRight={1} flexShrink={0} flexDirection="row" gap={2}>
          <text
            content={logsSource === 'static' ? '● Static log' : '○ Static log'}
            fg={logsSource === 'static' ? theme.primary : theme.textMuted}
          />
          <text
            content={logsSource === 'live' ? '● Live getLog' : '○ Live getLog'}
            fg={logsSource === 'live' ? theme.primary : theme.textMuted}
          />
          <text content="l toggle" fg={theme.textMuted} />
        </box>
      ) : null}
      {body}
    </box>
  )
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
  mode: 'static' | 'live'
  title: string
}

function LogsView({ mode, title }: LogsViewProps) {
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

  const chromeRows = mode === 'live' ? LOGS_CHROME_ROWS_LIVE : LOGS_CHROME_ROWS_STATIC
  const capacity = computeTableCapacity(chromeRows, terminalHeight)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [scrollOffset, setScrollOffset] = useState(0)

  const selectedIndexRef = useRef(0)
  const scrollOffsetRef = useRef(0)
  const capacityRef = useRef(capacity)
  const displayLenRef = useRef(displayLines.length)
  const followingRef = useRef(following)
  const toggleCategoryRef = useRef(toggleCategory)
  const setFollowingRef = useRef(setFollowing)
  const setSearchEditingRef = useRef(setSearchEditing)
  const setFilterEditingRef = useRef(setFilterEditing)

  selectedIndexRef.current = selectedIndex
  scrollOffsetRef.current = scrollOffset
  capacityRef.current = capacity
  displayLenRef.current = displayLines.length
  followingRef.current = following
  toggleCategoryRef.current = toggleCategory
  setFollowingRef.current = setFollowing
  setSearchEditingRef.current = setSearchEditing
  setFilterEditingRef.current = setFilterEditing

  useEffect(
    function pinSelectionWhenFollowing() {
      if (following) {
        setSelectedIndex(0)
        setScrollOffset(0)
      }
    },
    [following, displayLines.length],
  )

  useEffect(
    function clampSelectionAndScroll() {
      const length = displayLines.length
      if (length === 0) {
        setSelectedIndex(0)
        setScrollOffset(0)
        return
      }
      setSelectedIndex((prev) => Math.min(prev, length - 1))
      const maxOffset = Math.max(0, length - capacity)
      setScrollOffset((prev) => Math.min(prev, maxOffset))
    },
    [displayLines.length, capacity],
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

  const statusLabel =
    mode === 'live'
      ? following
        ? `polling getLog · ${stats.bufferedCount} lines buffered`
        : `paused · ${stats.bufferedCount} lines buffered`
      : following
        ? `tailing · ${stats.bufferedCount} lines buffered`
        : `paused · ${stats.bufferedCount} lines buffered`

  useFooterStatus(error != null ? error : statusLabel)
  useFooterKeybindings(LOGS_FOOTER)

  useBindings(
    function createLogsLayer() {
      function moveSelection(delta: number) {
        const length = displayLenRef.current
        if (length === 0) {
          return
        }
        if (followingRef.current) {
          setFollowingRef.current(false)
        }

        const prev = selectedIndexRef.current
        const next = Math.max(0, Math.min(length - 1, prev + delta))
        if (next === prev) {
          return
        }
        setSelectedIndex(next)

        const cap = capacityRef.current
        const offset = scrollOffsetRef.current
        if (next < offset) {
          setScrollOffset(next)
        } else if (next >= offset + cap) {
          setScrollOffset(next - cap + 1)
        }
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
              moveSelection(-1)
            },
          },
          {
            name: 'logs.move-down',
            run() {
              moveSelection(1)
            },
          },
          {
            name: 'logs.toggle-follow',
            run() {
              const next = !followingRef.current
              setFollowingRef.current(next)
              if (next) {
                setSelectedIndex(0)
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
  const relativeSelectedIndex =
    selectedIndex >= scrollOffset && selectedIndex < scrollOffset + capacity
      ? selectedIndex - scrollOffset
      : -1

  const content =
    displayLines.length > 0
      ? buildLogsTableContent(visible, relativeSelectedIndex, theme, capacity, search)
      : null

  return (
    <box flexGrow={1} flexShrink={1} flexDirection="column" paddingLeft={1} paddingRight={1}>
      <box flexDirection="column" flexShrink={0} gap={0}>
        <box flexDirection="row" justifyContent="space-between">
          <text content={displayText(title)} fg={theme.text} attributes={TextAttributes.BOLD} />
          <text content={statusLabel} fg={theme.textMuted} />
        </box>
        {mode === 'live' ? <text content={GET_LOG_FIDELITY_NOTE} fg={theme.warning} /> : null}
      </box>

      <box
        flexDirection="row"
        gap={1}
        flexShrink={0}
        flexWrap="wrap"
        paddingTop={1}
        paddingBottom={1}
      >
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
        <box flexDirection="row" gap={1} paddingBottom={1} flexShrink={0}>
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

      {content == null ? (
        <box flexGrow={1} flexShrink={1}>
          <text content="no matching log lines" fg={theme.textMuted} />
        </box>
      ) : (
        <DataTextTable content={content} theme={theme} />
      )}

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
        {mode === 'live' ? (
          <>
            <text content={`format: ${stats.format}`} fg={theme.textMuted} />
            <text content={`lines/sec: ~${stats.linesPerSec}`} fg={theme.textMuted} />
            <text content={`RAM ring wraps: ${stats.restartsDetected}`} fg={theme.textMuted} />
          </>
        ) : (
          <>
            <text content={`parser status  format: ${stats.format}`} fg={theme.textMuted} />
            <text content={`lines/sec: ~${stats.linesPerSec}`} fg={theme.textMuted} />
            <text content={`restarts detected: ${stats.restartsDetected}`} fg={theme.textMuted} />
          </>
        )}
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

function buildLogsTableContent(
  lines: TailLogLine[],
  selectedIndex: number,
  theme: Theme,
  rowCapacity: number,
  search: string,
): TextTableContent {
  const header: TextChunk[][] = [
    headerCell('TIME', theme),
    headerCell('S', theme),
    headerCell('COMPONENT', theme),
    headerCell('MSG', theme),
    headerCell('NAMESPACE', theme),
    headerCell('DURATION', theme),
    headerCell('PLAN', theme),
  ]

  const rows: TextTableContent = [header]
  for (let i = 0; i < lines.length; i++) {
    rows.push(buildLogRow(lines[i]!, i === selectedIndex, theme, search))
  }

  return padTableRows(rows, rowCapacity)
}

function buildLogRow(
  line: TailLogLine,
  selected: boolean,
  theme: Theme,
  search: string,
): TextChunk[][] {
  const sev = line.severityLabel || '?'
  const sevColor = severityFg(sev, theme)
  const needle = search.trim().toLowerCase()

  const msg = truncateLogCell(line.msg, 36)
  const msgMatches = needle.length > 0 && line.msg.toLowerCase().includes(needle)
  const msgLabel = selected ? `${msg} ●` : msg
  const msgColor = selected ? theme.primary : msgMatches ? theme.warning : theme.text

  const namespace = line.namespace ?? '—'
  const nsLabel = truncateLogCell(namespace, 20)
  const nsMatches =
    needle.length > 0 && line.namespace != null && line.namespace.toLowerCase().includes(needle)
  const nsColor = namespace === '—' ? theme.textMuted : nsMatches ? theme.warning : theme.text

  const duration = line.durationMillis != null ? `${Math.round(line.durationMillis)}ms` : '—'
  const durationColor = line.durationMillis == null ? theme.textMuted : theme.error

  const plan = line.planSummary != null ? truncateLogCell(line.planSummary, 16) : '—'
  const planColor = line.planSummary == null ? theme.textMuted : theme.accent

  return [
    tableCell(formatLogTimestamp(line.timestamp), theme.textMuted),
    tableCell(sev, sevColor),
    tableCell(truncateLogCell(line.component || 'RAW', 10), sevColor),
    tableCell(msgLabel, msgColor),
    tableCell(nsLabel, nsColor),
    tableCell(duration, durationColor),
    tableCell(plan, planColor),
  ]
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

function truncateLogCell(value: string, maxLen: number): string {
  return truncateText(value, maxLen)
}
