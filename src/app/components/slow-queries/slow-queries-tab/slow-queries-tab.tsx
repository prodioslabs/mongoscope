import { type TextChunk, type TextTableContent } from '@opentui/core'
import { useBindings } from '@opentui/keymap/react'
import { useTerminalDimensions } from '@opentui/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { QueryPattern } from '../../../../query-patterns'
import {
  computeTableCapacity,
  headerCell,
  padTableRows,
  severityColor,
  tableCell,
} from '../../../lib/text-table-content'
import { type AppKeymapMode } from '../../../lib/keymap-mode'
import { SLOW_QUERIES_FOOTER, SLOW_QUERIES_SHORTCUTS, toBindings } from '../../../shortcuts'
import { useSession, type SlowQueriesPendingNavigation } from '../../../stores/session'
import { useTheme } from '../../../stores/theme'
import { type Theme } from '../../../theme'
import { DataTextTable } from '../../data-text-table'
import { useFooterKeybindings, useFooterStatus } from '../../footer-keybindings'
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
} from '../format'
import { QueryDetailDialog } from '../query-detail-dialog'

type SortBy = 'count' | 'avgMs' | 'plan'
type SortDirection = 'asc' | 'desc'

/**
 * Non-data lines: tab bar, footer, header content line, and outer/header border
 * overhead so that `2 * capacity + 3 <= terminalHeight - 2`.
 */
const CHROME_ROWS = 5
const CROSS_TAB_STATUS_MS = 3000

export function SlowQueriesTab() {
  const theme = useTheme((s) => s.theme)
  const queryPatterns = useSession((s) => s.queryPatterns)
  const logStore = useSession((s) => s.logStore)
  const consumePendingSlowQueriesNav = useSession((s) => s.consumePendingSlowQueriesNav)
  const { height: terminalHeight } = useTerminalDimensions()

  const patterns = queryPatterns?.patterns ?? []
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [scrollOffset, setScrollOffset] = useState(0)
  const [sortBy, setSortBy] = useState<SortBy>('count')
  const [detailPatternId, setDetailPatternId] = useState<number | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [crossTabStatus, setCrossTabStatus] = useState<string | null>(null)
  const selectedIndexRef = useRef(0)
  const scrollOffsetRef = useRef(0)
  const capacityRef = useRef(1)
  const sortedLengthRef = useRef(0)
  const sortedPatternsRef = useRef<QueryPattern[]>([])
  const sortByRef = useRef(sortBy)
  const sortDirectionRef = useRef(sortDirection)
  const pendingNavRef = useRef<SlowQueriesPendingNavigation | null>(null)
  const pendingNavConsumedRef = useRef(false)

  const sortedPatterns = useMemo(
    () => sortPatterns(patterns, sortBy, sortDirection),
    [patterns, sortBy, sortDirection],
  )
  const detailPattern =
    detailPatternId == null
      ? null
      : (sortedPatterns.find((pattern) => pattern.id === detailPatternId) ?? null)

  const capacity = computeTableCapacity(CHROME_ROWS, terminalHeight)

  const windowLabel =
    queryPatterns != null
      ? formatWindowLabel(queryPatterns.windowStartMs, queryPatterns.windowEndMs)
      : 'full log'

  const footerStatus = crossTabStatus ?? windowLabel

  useFooterKeybindings(SLOW_QUERIES_FOOTER)
  useFooterStatus(footerStatus)

  useEffect(
    function consumePendingSlowQueriesNavigation() {
      if (pendingNavConsumedRef.current) {
        return
      }
      pendingNavConsumedRef.current = true
      pendingNavRef.current = consumePendingSlowQueriesNav()
    },
    [consumePendingSlowQueriesNav],
  )

  useEffect(
    function applyPendingSlowQueriesNavigation() {
      const pending = pendingNavRef.current
      if (pending == null) {
        return undefined
      }

      let statusTimer: ReturnType<typeof setTimeout> | null = null

      if (pending.statusMessage != null && pending.statusMessage.trim() !== '') {
        setCrossTabStatus(pending.statusMessage)
        statusTimer = setTimeout(function clearCrossTabStatus() {
          setCrossTabStatus(null)
        }, CROSS_TAB_STATUS_MS)
      }

      if (pending.patternId != null && sortedPatterns.length > 0) {
        const index = sortedPatterns.findIndex((pattern) => pattern.id === pending.patternId)
        if (index >= 0) {
          setSelectedIndex(index)
          setScrollOffset((offset) => {
            if (index < offset) {
              return index
            }
            if (index >= offset + capacity) {
              return index - capacity + 1
            }
            return offset
          })
          if (pending.openDetail === true) {
            setDetailPatternId(pending.patternId)
          }
        }
      }

      if (pending.patternId == null || sortedPatterns.length > 0) {
        pendingNavRef.current = null
      }

      if (statusTimer != null) {
        return function disposeCrossTabStatusTimer() {
          clearTimeout(statusTimer!)
        }
      }
      return undefined
    },
    [capacity, sortedPatterns],
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

  useBindings(function createSlowQueriesLayer() {
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
      if (pattern == null) return
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

    return {
      appMode: 'base' satisfies AppKeymapMode,
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
      ],
      bindings: toBindings(SLOW_QUERIES_SHORTCUTS),
    }
  }, [])

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
      {content == null ? (
        <box flexGrow={1} flexShrink={1}>
          <text content="no slow queries" fg={theme.textMuted} />
        </box>
      ) : (
        <DataTextTable content={content} theme={theme} />
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
    headerCell(headerLabel('COUNT', 'count', sortBy, sortDirection), theme),
    headerCell(headerLabel('AVG MS', 'avgMs', sortBy, sortDirection), theme),
    headerCell('EXAMINED/RET', theme),
    headerCell(headerLabel('PLAN', 'plan', sortBy, sortDirection), theme),
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

  return padTableRows(rows, rowCapacity)
}


function buildPatternRow(
  pattern: QueryPattern,
  selected: boolean,
  namespaceWidth: number,
  theme: Theme,
): TextChunk[][] {
  const msSeverity = avgMsSeverity(pattern.avgMs)
  const examSeverity = examinedSeverity(pattern.avgDocsExamined, pattern.avgDocsReturned)
  const pSeverity = planSeverity(pattern.plan)

  return [
    selected
      ? tableCell(`${pattern.namespace} ●`, theme.primary)
      : tableCell(pattern.namespace, theme.info),
    tableCell(truncateCell(pattern.op), theme.textMuted),
    tableCell(formatCount(pattern.count), theme.textMuted),
    tableCell(formatCount(pattern.avgMs), severityColor(theme, msSeverity)),
    tableCell(
      formatExaminedRet(pattern.avgDocsExamined, pattern.avgDocsReturned),
      severityColor(theme, examSeverity),
    ),
    tableCell(pattern.plan, severityColor(theme, pSeverity)),
    tableCell(sparkline(pattern.trend), severityColor(theme, msSeverity)),
  ]
}
