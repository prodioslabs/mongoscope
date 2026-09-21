import { bold, fg, type RGBA, type TextChunk, type TextTableContent } from '@opentui/core'
import { useBindings } from '@opentui/keymap/react'
import { useTerminalDimensions } from '@opentui/react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { QueryPattern } from '../../../../query-patterns'
import { displayText } from '../../../../lib/display-text'
import { formatLogTailPreset } from '../../../../parser'
import { DEFAULT_SLOWMS, type ProfilerSlowQueriesSnapshot } from '../../../../profiler'
import { type AppKeymapMode } from '../../../lib/keymap-mode'
import {
  useEnableProfiling,
  useProfilerSlowQueriesSnapshot,
} from '../../../queries/slow-queries'
import {
  SLOW_QUERIES_LIVE_FOOTER,
  SLOW_QUERIES_SHORTCUTS,
  SLOW_QUERIES_STATIC_FOOTER,
  toBindings,
} from '../../../shortcuts'
import { useLiveConnection } from '../../../stores/live-connection'
import { useSession } from '../../../stores/session'
import { useTheme } from '../../../stores/theme'
import { type Theme } from '../../../theme'
import '../../../lib/opentui-text-table'
import { DbSelector } from '../../db-selector'
import { useFooterKeybindings, useFooterStatus } from '../../footer-keybindings'
import { EnableProfilingDialog } from '../enable-profiling-dialog'
import {
  avgMsSeverity,
  examinedSeverity,
  formatCount,
  formatExaminedRet,
  formatWindowLabel,
  planSeverity,
  planSortRank,
  sparkline,
  truncateCell,
  type Severity,
} from '../format'
import { QueryDetailDialog } from '../query-detail-dialog'
import { StatsCard } from '../stats-card'

type SortBy = 'count' | 'avgMs' | 'plan'
type SortDirection = 'asc' | 'desc'

type SlowQueryStats = {
  patternCount: string
  queryCount: string
  slowest: string
  slowestSeverity: Severity
  collscanShare: string
  collscanSeverity: Severity
}

const CHROME_ROWS_STATIC = 10
const CHROME_ROWS_LIVE = 12
const ROW_STRIDE = 2
const COLUMN_COUNT = 7

export function SlowQueriesTab() {
  const theme = useTheme((s) => s.theme)
  const activeConnectionId = useSession((s) => s.activeConnectionId)
  const slowQueriesSource = useSession((s) => s.slowQueriesSource)
  const setSlowQueriesSource = useSession((s) => s.setSlowQueriesSource)
  const liveStatus = useLiveConnection((s) => s.status)
  const liveErrorMessage = useLiveConnection((s) => s.errorMessage)

  const useLive =
    slowQueriesSource === 'live' && activeConnectionId != null && liveStatus === 'connected'
  const showSourceToggle = activeConnectionId != null

  const dashboardEnabled = useLive
  const { data: snapshot, isPending } = useProfilerSlowQueriesSnapshot(dashboardEnabled)

  useBindings(
    function createSlowQueriesSourceLayer() {
      return {
        appMode: 'base' satisfies AppKeymapMode,
        enabled: showSourceToggle,
        priority: 5,
        commands: [
          {
            name: 'slow-queries.toggle-source',
            run() {
              setSlowQueriesSource(slowQueriesSource === 'live' ? 'static' : 'live')
            },
          },
        ],
        bindings: [{ key: 'l', cmd: 'slow-queries.toggle-source' }],
      }
    },
    [setSlowQueriesSource, showSourceToggle, slowQueriesSource],
  )

  let body: ReactNode
  if (useLive) {
    body = (
      <box flexGrow={1} flexShrink={1} flexDirection="column">
        <DbSelector />
        <LiveSlowQueriesDashboard snapshot={snapshot} isPending={isPending} />
      </box>
    )
  } else if (slowQueriesSource === 'live' && activeConnectionId != null) {
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
  } else {
    body = <StaticSlowQueriesPanel />
  }

  return (
    <box flexGrow={1} flexShrink={1} flexDirection="column">
      {showSourceToggle ? (
        <box paddingLeft={1} paddingRight={1} flexShrink={0} flexDirection="row" gap={2}>
          <text
            content={slowQueriesSource === 'static' ? '● Static log' : '○ Static log'}
            fg={slowQueriesSource === 'static' ? theme.primary : theme.textMuted}
          />
          <text
            content={slowQueriesSource === 'live' ? '● Live profiler' : '○ Live profiler'}
            fg={slowQueriesSource === 'live' ? theme.primary : theme.textMuted}
          />
          <text content="l toggle" fg={theme.textMuted} />
        </box>
      ) : null}
      {body}
    </box>
  )
}

function StaticSlowQueriesPanel() {
  const theme = useTheme((s) => s.theme)
  const queryPatterns = useSession((s) => s.queryPatterns)
  const logStore = useSession((s) => s.logStore)
  const logTailLines = useSession((s) => s.logTailLines)
  const cycleLogTailLines = useSession((s) => s.cycleLogTailLines)
  const parseProgress = useSession((s) => s.parseProgress)
  const consumePendingSlowQueriesNav = useSession((s) => s.consumePendingSlowQueriesNav)
  const { height: terminalHeight } = useTerminalDimensions()

  const patterns = queryPatterns?.patterns ?? []
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [scrollOffset, setScrollOffset] = useState(0)
  const [sortBy, setSortBy] = useState<SortBy>('count')
  const [detailPatternId, setDetailPatternId] = useState<number | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [transientStatus, setTransientStatus] = useState<string | null>(null)
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const selectedIndexRef = useRef(0)
  const scrollOffsetRef = useRef(0)
  const capacityRef = useRef(1)
  const sortedLengthRef = useRef(0)
  const sortedPatternsRef = useRef<QueryPattern[]>([])
  const sortByRef = useRef(sortBy)
  const sortDirectionRef = useRef(sortDirection)

  const stats = useMemo(() => computeSlowQueryStats(patterns), [patterns])
  const sortedPatterns = useMemo(
    () => sortPatterns(patterns, sortBy, sortDirection),
    [patterns, sortBy, sortDirection],
  )
  const detailPattern =
    detailPatternId == null
      ? null
      : (sortedPatterns.find((pattern) => pattern.id === detailPatternId) ?? null)

  const capacity = Math.max(1, Math.floor((terminalHeight - CHROME_ROWS_STATIC) / ROW_STRIDE))
  const windowLabel =
    queryPatterns != null
      ? formatWindowLabel(queryPatterns.windowStartMs, queryPatterns.windowEndMs)
      : 'no log'
  const statusLabel =
    transientStatus ??
    (parseProgress != null
      ? `parsing… ${parseProgress}%`
      : `tail ${formatLogTailPreset(logTailLines)} · ${windowLabel}`)

  useFooterKeybindings(SLOW_QUERIES_STATIC_FOOTER)
  useFooterStatus(statusLabel)

  const showTransientStatus = useCallback(function showTransientStatus(message: string) {
    setTransientStatus(message)
    if (statusTimerRef.current != null) {
      clearTimeout(statusTimerRef.current)
    }
    statusTimerRef.current = setTimeout(function clearTransientStatus() {
      setTransientStatus(null)
      statusTimerRef.current = null
    }, 4000)
  }, [])

  useEffect(function cleanupStatusTimer() {
    return function disposeStatusTimer() {
      if (statusTimerRef.current != null) {
        clearTimeout(statusTimerRef.current)
      }
    }
  }, [])

  useEffect(
    function applyPendingSlowQueriesNav() {
      const pending = consumePendingSlowQueriesNav()
      if (pending == null) {
        return
      }
      if (pending.statusMessage) {
        showTransientStatus(pending.statusMessage)
      }
      if (pending.patternId != null) {
        setDetailPatternId(pending.openDetail ? pending.patternId : null)
        const index = sortedPatternsRef.current.findIndex((p) => p.id === pending.patternId)
        if (index >= 0) {
          setSelectedIndex(index)
          setScrollOffset(Math.max(0, index - Math.floor(capacityRef.current / 2)))
        }
      }
    },
    [consumePendingSlowQueriesNav, showTransientStatus],
  )

  useEffect(
    function clampSlowQueriesSelection() {
      setSelectedIndex((index) => {
        if (sortedPatterns.length === 0) {
          return 0
        }
        return Math.min(index, sortedPatterns.length - 1)
      })
      setScrollOffset((offset) => {
        if (sortedPatterns.length === 0) {
          return 0
        }
        const maxOffset = Math.max(0, sortedPatterns.length - capacity)
        return Math.min(offset, maxOffset)
      })
    },
    [sortedPatterns.length, capacity],
  )

  useEffect(
    function syncSelectedIndexRef() {
      selectedIndexRef.current = selectedIndex
    },
    [selectedIndex],
  )
  useEffect(
    function syncScrollOffsetRef() {
      scrollOffsetRef.current = scrollOffset
    },
    [scrollOffset],
  )
  useEffect(
    function syncCapacityRef() {
      capacityRef.current = capacity
    },
    [capacity],
  )
  useEffect(
    function syncSortedLengthRef() {
      sortedLengthRef.current = sortedPatterns.length
    },
    [sortedPatterns.length],
  )
  useEffect(
    function syncSortedPatternsRef() {
      sortedPatternsRef.current = sortedPatterns
    },
    [sortedPatterns],
  )
  useEffect(
    function syncSortByRef() {
      sortByRef.current = sortBy
    },
    [sortBy],
  )
  useEffect(
    function syncSortDirectionRef() {
      sortDirectionRef.current = sortDirection
    },
    [sortDirection],
  )

  useBindings(
    function createStaticSlowQueriesLayer() {
      function moveSelection(delta: number) {
        const length = sortedLengthRef.current
        if (length === 0) {
          return
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

      function applySort(next: SortBy) {
        if (sortedLengthRef.current === 0) {
          return
        }
        if (sortByRef.current === next) {
          setSortDirection((direction) => (direction === 'desc' ? 'asc' : 'desc'))
        } else {
          setSortBy(next)
          setSortDirection('desc')
        }
        setSelectedIndex(0)
        setScrollOffset(0)
      }

      return {
        appMode: 'base' satisfies AppKeymapMode,
        enabled: detailPatternId == null,
        commands: [
          {
            name: 'slow-queries.sort-count',
            run() {
              applySort('count')
            },
          },
          {
            name: 'slow-queries.sort-avg',
            run() {
              applySort('avgMs')
            },
          },
          {
            name: 'slow-queries.sort-plan',
            run() {
              applySort('plan')
            },
          },
          {
            name: 'slow-queries.move-up',
            run() {
              moveSelection(-1)
            },
          },
          {
            name: 'slow-queries.move-down',
            run() {
              moveSelection(1)
            },
          },
          {
            name: 'slow-queries.open-details',
            run() {
              const pattern = sortedPatternsRef.current[selectedIndexRef.current]
              if (pattern == null) {
                return
              }
              setDetailPatternId(pattern.id)
            },
          },
          {
            name: 'slow-queries.cycle-tail',
            run() {
              void cycleLogTailLines()
            },
          },
        ],
        bindings: toBindings(
          SLOW_QUERIES_SHORTCUTS.filter(function keepStaticBindings(shortcut) {
            return (
              shortcut.bindings.some((b) => b.cmd.startsWith('slow-queries.move')) ||
              shortcut.bindings.some((b) => b.cmd.startsWith('slow-queries.sort')) ||
              shortcut.bindings.some((b) => b.cmd === 'slow-queries.open-details') ||
              shortcut.bindings.some((b) => b.cmd === 'slow-queries.cycle-tail')
            )
          }),
        ),
      }
    },
    [cycleLogTailLines, detailPatternId],
  )

  const visible = sortedPatterns.slice(scrollOffset, scrollOffset + capacity)
  const content =
    sortedPatterns.length > 0
      ? buildTableContent(
          visible,
          selectedIndex - scrollOffset,
          theme,
          capacity,
          sortBy,
          sortDirection,
        )
      : null

  return (
    <box flexGrow={1} flexShrink={1} flexDirection="column">
      <box paddingLeft={1} paddingRight={1} flexShrink={0}>
        <text
          content={displayText(`tail ${formatLogTailPreset(logTailLines)} · press T to cycle`)}
          fg={theme.textMuted}
        />
      </box>
      <box
        flexDirection="row"
        flexShrink={0}
        gap={1}
        paddingLeft={1}
        paddingRight={1}
        paddingBottom={0}
      >
        <StatsCard icon="◈" label="patterns" value={stats.patternCount} />
        <StatsCard icon="≡" label="queries" value={stats.queryCount} />
        <StatsCard
          icon="◷"
          label="slowest"
          value={stats.slowest}
          valueColor={severityColor(theme, stats.slowestSeverity)}
        />
        <StatsCard
          icon="⚠"
          label="collscan"
          value={stats.collscanShare}
          valueColor={severityColor(theme, stats.collscanSeverity)}
        />
      </box>
      {content == null ? (
        <box flexGrow={1} flexShrink={1} paddingLeft={1}>
          <text
            content={parseProgress != null ? 'parsing log…' : 'no slow queries'}
            fg={theme.textMuted}
          />
        </box>
      ) : (
        <textTable
          content={content}
          flexGrow={1}
          border
          outerBorder
          borderStyle="single"
          borderColor={theme.border}
          wrapMode="none"
          cellPaddingX={0}
          selectable={false}
          height="100%"
          width="100%"
        />
      )}
      <QueryDetailDialog
        open={detailPatternId != null}
        pattern={detailPattern}
        logStore={logStore}
        queryPatterns={queryPatterns}
        onClose={() => setDetailPatternId(null)}
      />
    </box>
  )
}

type LiveSlowQueriesDashboardProps = {
  snapshot: ProfilerSlowQueriesSnapshot | undefined
  isPending: boolean
}

function LiveSlowQueriesDashboard({ snapshot, isPending }: LiveSlowQueriesDashboardProps) {
  const theme = useTheme((s) => s.theme)
  const selectedDatabase = useSession((s) => s.selectedDatabase)
  const setSelectedDatabase = useSession((s) => s.setSelectedDatabase)
  const consumePendingSlowQueriesNav = useSession((s) => s.consumePendingSlowQueriesNav)
  const { height: terminalHeight } = useTerminalDimensions()
  const enableMutation = useEnableProfiling()

  const patterns = snapshot?.patterns ?? []
  const samples = snapshot?.samples ?? []
  const databases = snapshot?.databases ?? []
  const profiling = snapshot?.profiling ?? null
  const database = snapshot?.database || selectedDatabase || ''

  const [selectedIndex, setSelectedIndex] = useState(0)
  const [scrollOffset, setScrollOffset] = useState(0)
  const [sortBy, setSortBy] = useState<SortBy>('count')
  const [detailPatternId, setDetailPatternId] = useState<number | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [enableDialogOpen, setEnableDialogOpen] = useState(false)
  const [enableErrorMessage, setEnableErrorMessage] = useState('')
  const [transientStatus, setTransientStatus] = useState<string | null>(null)
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const selectedIndexRef = useRef(0)
  const scrollOffsetRef = useRef(0)
  const capacityRef = useRef(1)
  const sortedLengthRef = useRef(0)
  const sortedPatternsRef = useRef<QueryPattern[]>([])
  const sortByRef = useRef(sortBy)
  const sortDirectionRef = useRef(sortDirection)
  const databasesRef = useRef(databases)
  const selectedDatabaseRef = useRef(selectedDatabase)
  const profilingRef = useRef(profiling)
  const databaseRef = useRef(database)
  const enableDialogOpenRef = useRef(enableDialogOpen)
  const detailOpenRef = useRef(false)

  const stats = useMemo(() => computeSlowQueryStats(patterns), [patterns])
  const sortedPatterns = useMemo(
    () => sortPatterns(patterns, sortBy, sortDirection),
    [patterns, sortBy, sortDirection],
  )
  const detailPattern =
    detailPatternId == null
      ? null
      : (sortedPatterns.find((pattern) => pattern.id === detailPatternId) ?? null)
  const detailSampleDoc =
    detailPattern != null ? (samples[detailPattern.sampleRow] ?? null) : null

  const capacity = Math.max(1, Math.floor((terminalHeight - CHROME_ROWS_LIVE) / ROW_STRIDE))
  const level = profiling?.level ?? null
  const canEnable = level === 0 && snapshot?.errors.topology == null
  const proposedSlowms = profiling?.slowms ?? DEFAULT_SLOWMS

  const statusLabel = transientStatus ?? formatProfilerStatusLabel(snapshot, isPending)
  useFooterKeybindings(enableDialogOpen ? [] : SLOW_QUERIES_LIVE_FOOTER)
  useFooterStatus(statusLabel)

  const showTransientStatus = useCallback(function showTransientStatus(message: string) {
    setTransientStatus(message)
    if (statusTimerRef.current != null) {
      clearTimeout(statusTimerRef.current)
    }
    statusTimerRef.current = setTimeout(function clearTransientStatus() {
      setTransientStatus(null)
      statusTimerRef.current = null
    }, 4000)
  }, [])

  useEffect(function cleanupStatusTimer() {
    return function disposeStatusTimer() {
      if (statusTimerRef.current != null) {
        clearTimeout(statusTimerRef.current)
      }
    }
  }, [])

  useEffect(
    function syncSelectedDatabaseFromSnapshot() {
      if (snapshot == null || snapshot.databases.length === 0) {
        return
      }
      if (selectedDatabase != null && snapshot.databases.includes(selectedDatabase)) {
        return
      }
      const next = snapshot.database || snapshot.databases[0]!
      if (next !== selectedDatabase) {
        setSelectedDatabase(next)
      }
    },
    [snapshot, selectedDatabase, setSelectedDatabase],
  )

  useEffect(
    function applyPendingSlowQueriesNav() {
      const pending = consumePendingSlowQueriesNav()
      if (pending == null) {
        return
      }
      if (pending.statusMessage) {
        showTransientStatus(pending.statusMessage)
      }
      if (pending.patternId != null) {
        setDetailPatternId(pending.openDetail ? pending.patternId : null)
        const index = sortedPatternsRef.current.findIndex((p) => p.id === pending.patternId)
        if (index >= 0) {
          setSelectedIndex(index)
          setScrollOffset(Math.max(0, index - Math.floor(capacityRef.current / 2)))
        }
      }
    },
    [consumePendingSlowQueriesNav, showTransientStatus],
  )

  useEffect(
    function clampSlowQueriesSelection() {
      setSelectedIndex((index) => {
        if (sortedPatterns.length === 0) {
          return 0
        }
        return Math.min(index, sortedPatterns.length - 1)
      })
      setScrollOffset((offset) => {
        if (sortedPatterns.length === 0) {
          return 0
        }
        const maxOffset = Math.max(0, sortedPatterns.length - capacity)
        return Math.min(offset, maxOffset)
      })
    },
    [sortedPatterns.length, capacity],
  )

  useEffect(
    function syncSelectedIndexRef() {
      selectedIndexRef.current = selectedIndex
    },
    [selectedIndex],
  )
  useEffect(
    function syncScrollOffsetRef() {
      scrollOffsetRef.current = scrollOffset
    },
    [scrollOffset],
  )
  useEffect(
    function syncCapacityRef() {
      capacityRef.current = capacity
    },
    [capacity],
  )
  useEffect(
    function syncSortedLengthRef() {
      sortedLengthRef.current = sortedPatterns.length
    },
    [sortedPatterns.length],
  )
  useEffect(
    function syncSortedPatternsRef() {
      sortedPatternsRef.current = sortedPatterns
    },
    [sortedPatterns],
  )
  useEffect(
    function syncSortByRef() {
      sortByRef.current = sortBy
    },
    [sortBy],
  )
  useEffect(
    function syncSortDirectionRef() {
      sortDirectionRef.current = sortDirection
    },
    [sortDirection],
  )
  useEffect(
    function syncDatabasesRef() {
      databasesRef.current = databases
    },
    [databases],
  )
  useEffect(
    function syncSelectedDatabaseRef() {
      selectedDatabaseRef.current = selectedDatabase
    },
    [selectedDatabase],
  )
  useEffect(
    function syncProfilingRef() {
      profilingRef.current = profiling
      databaseRef.current = database
    },
    [profiling, database],
  )
  useEffect(
    function syncEnableDialogOpenRef() {
      enableDialogOpenRef.current = enableDialogOpen
      detailOpenRef.current = detailPatternId != null
    },
    [enableDialogOpen, detailPatternId],
  )

  const cycleDatabase = useCallback(
    function cycleDatabaseByDelta(delta: number) {
      const list = databasesRef.current
      if (list.length === 0) {
        return
      }
      const current = selectedDatabaseRef.current
      const currentIndex = current == null ? -1 : list.indexOf(current)
      const base = currentIndex >= 0 ? currentIndex : 0
      const nextIndex = (base + delta + list.length) % list.length
      setSelectedDatabase(list[nextIndex]!)
    },
    [setSelectedDatabase],
  )

  const handleEnableConfirm = useCallback(
    function confirmEnableProfiling() {
      if (enableMutation.isPending) {
        return
      }
      const db = databaseRef.current
      const slowms = profilingRef.current?.slowms ?? DEFAULT_SLOWMS
      setEnableErrorMessage('')
      enableMutation.mutate(
        { database: db, slowms },
        {
          onSuccess(result) {
            if (result.ok) {
              setEnableDialogOpen(false)
              showTransientStatus(`profiling enabled on ${db} · slowms ${result.slowms}`)
            } else {
              setEnableErrorMessage(result.error.message)
            }
          },
          onError(error: unknown) {
            setEnableErrorMessage(error instanceof Error ? error.message : String(error))
          },
        },
      )
    },
    [enableMutation, showTransientStatus],
  )

  useBindings(
    function createSlowQueriesLayer() {
      function moveSelection(delta: number) {
        const length = sortedLengthRef.current
        if (length === 0) {
          return
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

      function openSelectedDetails() {
        const pattern = sortedPatternsRef.current[selectedIndexRef.current]
        if (pattern == null) {
          return
        }
        setDetailPatternId(pattern.id)
      }

      function applySort(next: SortBy) {
        if (sortedLengthRef.current === 0) {
          return
        }
        if (sortByRef.current === next) {
          setSortDirection((direction) => (direction === 'desc' ? 'asc' : 'desc'))
        } else {
          setSortBy(next)
          setSortDirection('desc')
        }
        setSelectedIndex(0)
        setScrollOffset(0)
      }

      function openEnableConfirm() {
        if (enableDialogOpenRef.current || detailOpenRef.current) {
          return
        }
        const status = profilingRef.current
        if (status == null) {
          showTransientStatus('profiling status unavailable')
          return
        }
        if (status.level !== 0) {
          showTransientStatus(`profiling already on · level ${status.level}`)
          return
        }
        setEnableErrorMessage('')
        setEnableDialogOpen(true)
      }

      return {
        appMode: 'base' satisfies AppKeymapMode,
        enabled: function slowQueriesBaseEnabled() {
          return !enableDialogOpenRef.current && !detailOpenRef.current
        },
        commands: [
          {
            name: 'slow-queries.sort-count',
            run() {
              applySort('count')
            },
          },
          {
            name: 'slow-queries.sort-avg',
            run() {
              applySort('avgMs')
            },
          },
          {
            name: 'slow-queries.sort-plan',
            run() {
              applySort('plan')
            },
          },
          {
            name: 'slow-queries.move-up',
            run() {
              moveSelection(-1)
            },
          },
          {
            name: 'slow-queries.move-down',
            run() {
              moveSelection(1)
            },
          },
          {
            name: 'slow-queries.open-details',
            run() {
              openSelectedDetails()
            },
          },
          {
            name: 'slow-queries.enable-open',
            run() {
              openEnableConfirm()
            },
          },
          {
            name: 'slow-queries.prev-database',
            run() {
              cycleDatabase(-1)
            },
          },
          {
            name: 'slow-queries.next-database',
            run() {
              cycleDatabase(1)
            },
          },
        ],
        bindings: toBindings(SLOW_QUERIES_SHORTCUTS),
      }
    },
    [cycleDatabase, showTransientStatus],
  )

  const visible = sortedPatterns.slice(scrollOffset, scrollOffset + capacity)
  const content =
    sortedPatterns.length > 0
      ? buildTableContent(
          visible,
          selectedIndex - scrollOffset,
          theme,
          capacity,
          sortBy,
          sortDirection,
        )
      : null

  const panelErrors = collectPanelErrors(snapshot)

  return (
    <box flexGrow={1} flexShrink={1} flexDirection="column">
      <box paddingLeft={1} paddingRight={1} flexShrink={0} gap={0}>
        <text
          content={displayText(
            `db ${database || '—'} · ${formatProfilingChip(profiling)} · [] cycle db`,
          )}
          fg={theme.textMuted}
        />
        {panelErrors.map((message) => (
          <text key={message} content={displayText(message)} fg={theme.error} />
        ))}
        {canEnable && patterns.length === 0 ? (
          <text
            content="profiler off — press e to enable (writes profiling config)"
            fg={theme.warning}
          />
        ) : null}
      </box>
      <box
        flexDirection="row"
        flexShrink={0}
        gap={1}
        paddingLeft={1}
        paddingRight={1}
        paddingBottom={0}
      >
        <StatsCard icon="◈" label="patterns" value={stats.patternCount} />
        <StatsCard icon="≡" label="queries" value={stats.queryCount} />
        <StatsCard
          icon="◷"
          label="slowest"
          value={stats.slowest}
          valueColor={severityColor(theme, stats.slowestSeverity)}
        />
        <StatsCard
          icon="⚠"
          label="collscan"
          value={stats.collscanShare}
          valueColor={severityColor(theme, stats.collscanSeverity)}
        />
      </box>
      {content == null ? (
        <box flexGrow={1} flexShrink={1} paddingLeft={1}>
          <text
            content={
              isPending && snapshot == null
                ? 'loading profiler…'
                : canEnable
                  ? 'no profiled operations yet — press e to enable'
                  : 'no slow queries in system.profile'
            }
            fg={theme.textMuted}
          />
        </box>
      ) : (
        <textTable
          content={content}
          flexGrow={1}
          border
          outerBorder
          borderStyle="single"
          borderColor={theme.border}
          wrapMode="none"
          cellPaddingX={0}
          selectable={false}
          height="100%"
          width="100%"
        />
      )}
      <QueryDetailDialog
        open={detailPatternId != null}
        pattern={detailPattern}
        sampleDoc={detailSampleDoc}
        onClose={() => setDetailPatternId(null)}
      />
      <EnableProfilingDialog
        open={enableDialogOpen}
        database={database}
        currentLevel={profiling?.level ?? 0}
        currentSlowms={profiling?.slowms ?? DEFAULT_SLOWMS}
        proposedSlowms={proposedSlowms}
        isPending={enableMutation.isPending}
        errorMessage={enableErrorMessage}
        onConfirm={handleEnableConfirm}
        onCancel={() => {
          setEnableDialogOpen(false)
          setEnableErrorMessage('')
        }}
      />
    </box>
  )
}

function formatProfilingChip(profiling: ProfilerSlowQueriesSnapshot['profiling']): string {
  if (profiling == null) {
    return 'profiling status unknown'
  }
  if (profiling.level === 0) {
    return `profiling off · slowms ${profiling.slowms}`
  }
  return `profiling on · level ${profiling.level} · slowms ${profiling.slowms}`
}

function formatProfilerStatusLabel(
  snapshot: ProfilerSlowQueriesSnapshot | undefined,
  isPending: boolean,
): string {
  if (snapshot == null) {
    return isPending ? 'loading…' : 'profiler'
  }
  const window =
    snapshot.slowQueryCount > 0
      ? formatWindowLabel(snapshot.windowStartMs, snapshot.windowEndMs)
      : 'no samples'
  return `${snapshot.database || '—'} · ${formatProfilingChip(snapshot.profiling)} · ${window}`
}

function collectPanelErrors(snapshot: ProfilerSlowQueriesSnapshot | undefined): string[] {
  if (snapshot == null) {
    return []
  }
  const messages: string[] = []
  if (snapshot.errors.topology != null) {
    messages.push(snapshot.errors.topology.message)
  }
  if (snapshot.errors.status != null) {
    messages.push(snapshot.errors.status.message)
  }
  if (snapshot.errors.read != null) {
    messages.push(snapshot.errors.read.message)
  }
  if (snapshot.errors.databases != null) {
    messages.push(snapshot.errors.databases.message)
  }
  return messages
}

function computeSlowQueryStats(patterns: QueryPattern[]): SlowQueryStats {
  if (patterns.length === 0) {
    return {
      patternCount: '0',
      queryCount: '0',
      slowest: '—',
      slowestSeverity: 'muted',
      collscanShare: '—',
      collscanSeverity: 'muted',
    }
  }

  let queryCount = 0
  let collscanCount = 0
  let slowest = patterns[0]!
  for (const pattern of patterns) {
    queryCount += pattern.count
    if (pattern.plan === 'COLLSCAN') {
      collscanCount += 1
    }
    if (
      pattern.avgMs > slowest.avgMs ||
      (pattern.avgMs === slowest.avgMs && pattern.count > slowest.count)
    ) {
      slowest = pattern
    }
  }

  const collscanPct = Math.round((100 * collscanCount) / patterns.length)

  return {
    patternCount: formatCount(patterns.length),
    queryCount: formatCount(queryCount),
    slowest: `${formatCount(slowest.avgMs)}ms ${truncateCell(slowest.namespace)}`,
    slowestSeverity: avgMsSeverity(slowest.avgMs),
    collscanShare: `${formatCount(collscanCount)} (${collscanPct}%)`,
    collscanSeverity: collscanCount > 0 ? 'error' : 'muted',
  }
}

function sortPatterns(
  patterns: QueryPattern[],
  sortBy: SortBy,
  sortDirection: SortDirection,
): QueryPattern[] {
  const copy = patterns.slice()
  const ascending = sortDirection === 'asc'
  copy.sort(function comparePatterns(a, b) {
    if (sortBy === 'count') {
      if (b.count !== a.count) {
        return ascending ? a.count - b.count : b.count - a.count
      }
      return ascending ? a.avgMs - b.avgMs : b.avgMs - a.avgMs
    }
    if (sortBy === 'avgMs') {
      if (b.avgMs !== a.avgMs) {
        return ascending ? a.avgMs - b.avgMs : b.avgMs - a.avgMs
      }
      return ascending ? a.count - b.count : b.count - a.count
    }
    const rankDiff = planSortRank(a.plan) - planSortRank(b.plan)
    if (rankDiff !== 0) {
      return ascending ? -rankDiff : rankDiff
    }
    return ascending ? a.count - b.count : b.count - a.count
  })
  return copy
}

function sortArrow(sortDirection: SortDirection): string {
  return sortDirection === 'desc' ? '▼' : '▲'
}

function headerLabel(
  base: string,
  column: SortBy | null,
  sortBy: SortBy,
  sortDirection: SortDirection,
): string {
  if (column == null || column !== sortBy) {
    return base
  }
  return `${base}${sortArrow(sortDirection)}`
}

function buildTableContent(
  patterns: QueryPattern[],
  selectedIndex: number,
  theme: Theme,
  rowCapacity: number,
  sortBy: SortBy,
  sortDirection: SortDirection,
): TextTableContent {
  const header: TextChunk[][] = [
    headerCell('NAMESPACE', theme),
    headerCell('OP', theme),
    headerCell(headerLabel('COUNT', 'count', sortBy, sortDirection), theme, sortBy === 'count'),
    headerCell(headerLabel('AVG MS', 'avgMs', sortBy, sortDirection), theme, sortBy === 'avgMs'),
    headerCell('EXAMINED/RET', theme),
    headerCell(headerLabel('PLAN', 'plan', sortBy, sortDirection), theme, sortBy === 'plan'),
    headerCell('TREND', theme),
  ]

  let namespaceWidth = 'NAMESPACE'.length
  for (const pattern of patterns) {
    if (pattern.namespace.length > namespaceWidth) {
      namespaceWidth = pattern.namespace.length
    }
  }

  const rows: TextTableContent = [header]

  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i]!
    const selected = i === selectedIndex
    rows.push(buildPatternRow(pattern, selected, namespaceWidth, theme))
  }

  while (rows.length - 1 < rowCapacity) {
    rows.push(emptyRow())
  }

  return rows
}

function emptyRow(): TextChunk[][] {
  return Array.from({ length: COLUMN_COUNT }, () => [])
}

function buildPatternRow(
  pattern: QueryPattern,
  selected: boolean,
  _namespaceWidth: number,
  theme: Theme,
): TextChunk[][] {
  const msSeverity = avgMsSeverity(pattern.avgMs)
  const examSeverity = examinedSeverity(pattern.avgDocsExamined, pattern.avgDocsReturned)
  const pSeverity = planSeverity(pattern.plan)

  return [
    selected ? cell(`${pattern.namespace} ●`, theme.primary) : cell(pattern.namespace, theme.info),
    cell(truncateCell(pattern.op), theme.textMuted),
    cell(formatCount(pattern.count), theme.textMuted),
    cell(formatCount(pattern.avgMs), severityColor(theme, msSeverity)),
    cell(
      formatExaminedRet(pattern.avgDocsExamined, pattern.avgDocsReturned),
      severityColor(theme, examSeverity),
    ),
    cell(pattern.plan, severityColor(theme, pSeverity)),
    cell(sparkline(pattern.trend), severityColor(theme, msSeverity)),
  ]
}

function headerCell(label: string, theme: Theme, active = false): TextChunk[] {
  return [bold(fg(active ? theme.primary : theme.textMuted)(label))]
}

function cell(text: string, color: RGBA): TextChunk[] {
  return [fg(color)(text)]
}

function severityColor(theme: Theme, severity: Severity): RGBA {
  switch (severity) {
    case 'error':
      return theme.error
    case 'warning':
      return theme.warning
    case 'success':
      return theme.success
    case 'muted':
      return theme.textMuted
  }
}
