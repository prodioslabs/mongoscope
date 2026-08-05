import { bg, bold, fg, type RGBA, type TextChunk, type TextTableContent } from '@opentui/core'
import { useBindings } from '@opentui/keymap/react'
import { useTerminalDimensions } from '@opentui/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { type FooterKeybinding } from '../../stores/footer'
import { useFooterKeybindings, useFooterStatus } from '../../stores/footer-keybindings'
import { type AppKeymapMode } from '../../lib/keymap-mode'
import { useSession } from '../../stores/session'
import { useTheme } from '../../stores/theme'
import { type Theme } from '../../theme'
import '../../lib/opentui-text-table'
import type { QueryPattern } from '../../../query-patterns'
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
} from './format'

type SortBy = 'count' | 'avgMs' | 'plan'

/**
 * Non-data lines: tab bar, footer, header content line, and outer/header border
 * overhead so that `2 * capacity + 3 <= terminalHeight - 2`.
 */
const CHROME_ROWS = 5

/** Approximate height of one data row (content line + inner border). */
const ROW_STRIDE = 2

const COLUMN_COUNT = 8

const SLOW_QUERIES_KEYBINDINGS: FooterKeybinding[] = [
  { keys: '↑↓/jk', label: 'navigate' },
  { keys: 'c/a/p', label: 'sort count/avg/plan' },
]

export function SlowQueriesTab() {
  const theme = useTheme((s) => s.theme)
  const queryPatterns = useSession((s) => s.queryPatterns)
  const { height: terminalHeight } = useTerminalDimensions()

  const patterns = queryPatterns?.patterns ?? []
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [scrollOffset, setScrollOffset] = useState(0)
  const [sortBy, setSortBy] = useState<SortBy>('count')
  const selectedIndexRef = useRef(0)
  const scrollOffsetRef = useRef(0)
  const capacityRef = useRef(1)
  const sortedLengthRef = useRef(0)

  const sortedPatterns = useMemo(() => sortPatterns(patterns, sortBy), [patterns, sortBy])

  const capacity = Math.max(1, Math.floor((terminalHeight - CHROME_ROWS) / ROW_STRIDE))

  const windowLabel =
    queryPatterns != null
      ? formatWindowLabel(queryPatterns.windowStartMs, queryPatterns.windowEndMs)
      : 'full log'

  useFooterKeybindings(SLOW_QUERIES_KEYBINDINGS)
  useFooterStatus(windowLabel)

  useEffect(
    function clampSlowQueriesSelection() {
      setSelectedIndex((index) => {
        if (sortedPatterns.length === 0) return 0
        return Math.min(index, sortedPatterns.length - 1)
      })
      setScrollOffset((offset) => {
        if (sortedPatterns.length === 0) return 0
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

  useBindings(function createSlowQueriesLayer() {
    function moveSelection(delta: number) {
      const length = sortedLengthRef.current
      if (length === 0) return

      const prev = selectedIndexRef.current
      const next = Math.max(0, Math.min(length - 1, prev + delta))
      if (next === prev) return
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
      commands: [
        {
          name: 'slow-queries.sort-count',
          run() {
            if (sortedLengthRef.current === 0) return
            setSortBy('count')
            setSelectedIndex(0)
            setScrollOffset(0)
          },
        },
        {
          name: 'slow-queries.sort-avg',
          run() {
            if (sortedLengthRef.current === 0) return
            setSortBy('avgMs')
            setSelectedIndex(0)
            setScrollOffset(0)
          },
        },
        {
          name: 'slow-queries.sort-plan',
          run() {
            if (sortedLengthRef.current === 0) return
            setSortBy('plan')
            setSelectedIndex(0)
            setScrollOffset(0)
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
      ],
      bindings: [
        { key: 'c', cmd: 'slow-queries.sort-count' },
        { key: 'a', cmd: 'slow-queries.sort-avg' },
        { key: 'p', cmd: 'slow-queries.sort-plan' },
        { key: 'up', cmd: 'slow-queries.move-up' },
        { key: 'k', cmd: 'slow-queries.move-up' },
        { key: 'down', cmd: 'slow-queries.move-down' },
        { key: 'j', cmd: 'slow-queries.move-down' },
      ],
    }
  }, [])

  const visible = sortedPatterns.slice(scrollOffset, scrollOffset + capacity)
  const content =
    sortedPatterns.length > 0
      ? buildTableContent(visible, selectedIndex - scrollOffset, theme, capacity)
      : null

  return (
    <box flexGrow={1} flexShrink={1} flexDirection="column">
      {content == null ? (
        <box flexGrow={1} flexShrink={1}>
          <text content="no slow queries" fg={theme.textMuted} />
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
    </box>
  )
}

function sortPatterns(patterns: QueryPattern[], sortBy: SortBy): QueryPattern[] {
  const copy = patterns.slice()
  copy.sort(function comparePatterns(a, b) {
    if (sortBy === 'count') {
      if (b.count !== a.count) return b.count - a.count
      return b.avgMs - a.avgMs
    }
    if (sortBy === 'avgMs') {
      if (b.avgMs !== a.avgMs) return b.avgMs - a.avgMs
      return b.count - a.count
    }
    const rankDiff = planSortRank(a.plan) - planSortRank(b.plan)
    if (rankDiff !== 0) return rankDiff
    return b.count - a.count
  })
  return copy
}

function buildTableContent(
  patterns: QueryPattern[],
  selectedIndex: number,
  theme: Theme,
  rowCapacity: number,
): TextTableContent {
  const header: TextChunk[][] = [
    headerCell('NAMESPACE', theme),
    headerCell('OP', theme),
    headerCell('COUNT', theme),
    headerCell('AVG MS', theme),
    headerCell('EXAMINED/RET', theme),
    headerCell('PLAN', theme),
    headerCell('TREND', theme),
  ]

  let namespaceWidth = 'NAMESPACE'.length
  for (const pattern of patterns) {
    if (pattern.namespace.length > namespaceWidth) namespaceWidth = pattern.namespace.length
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
  namespaceWidth: number,
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

function headerCell(label: string, theme: Theme): TextChunk[] {
  return [bold(fg(theme.textMuted)(label))]
}

function cell(text: string, color: RGBA, background?: RGBA): TextChunk[] {
  const colored = fg(color)(text)
  if (background) return [bg(background)(colored)]
  return [colored]
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
