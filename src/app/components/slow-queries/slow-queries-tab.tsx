import {
  bg,
  bold,
  fg,
  type KeyEvent,
  type RGBA,
  type TextChunk,
  type TextTableContent,
} from '@opentui/core'
import { useKeyboard, useTerminalDimensions } from '@opentui/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFooter, type FooterKeybinding } from '../../stores/footer'
import { useFooterKeybindings } from '../../stores/footer-keybindings'
import { useSession } from '../../stores/session'
import { useTheme } from '../../stores/theme'
import { selectedForeground, type Theme } from '../../theme'
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
  truncateShape,
  type Severity,
} from './format'

type SortBy = 'count' | 'avgMs' | 'plan'

/** Rows reserved for tab bar, paddings, footer, and table chrome. */
const CHROME_ROWS = 7

/** Approximate height of one data row (content line + inner border). */
const ROW_STRIDE = 2

const SLOW_QUERIES_KEYBINDINGS: FooterKeybinding[] = [
  { keys: '↑↓/jk', label: 'navigate' },
  { keys: 'c/a/p', label: 'sort count/avg/plan' },
]

export function SlowQueriesTab() {
  const theme = useTheme((s) => s.theme)
  const queryPatterns = useSession((s) => s.queryPatterns)
  const setStatus = useFooter((s) => s.setStatus)
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

  useEffect(
    function syncSlowQueriesFooterStatus() {
      setStatus(`grouped by shape · ${windowLabel}`)
      return function clearSlowQueriesFooterStatus() {
        setStatus(null)
      }
    },
    [windowLabel, setStatus],
  )

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

  useKeyboard(function slowQueriesKeyHandler(key: KeyEvent) {
    const length = sortedLengthRef.current
    if (length === 0) return

    if (key.name === 'c' || key.name === 'a' || key.name === 'p') {
      key.preventDefault()
      const next: SortBy = key.name === 'c' ? 'count' : key.name === 'a' ? 'avgMs' : 'plan'
      setSortBy(next)
      setSelectedIndex(0)
      setScrollOffset(0)
      return
    }

    const delta =
      key.name === 'up' || key.name === 'k' ? -1 : key.name === 'down' || key.name === 'j' ? 1 : 0
    if (delta === 0) return

    key.preventDefault()
    const prev = selectedIndexRef.current
    const next = (prev + delta + length) % length
    setSelectedIndex(next)

    const cap = capacityRef.current
    const offset = scrollOffsetRef.current
    if (next < offset) {
      setScrollOffset(next)
    } else if (next >= offset + cap) {
      setScrollOffset(next - cap + 1)
    } else if (prev === length - 1 && next === 0) {
      setScrollOffset(0)
    } else if (prev === 0 && next === length - 1) {
      setScrollOffset(Math.max(0, length - cap))
    }
  })

  const visible = sortedPatterns.slice(scrollOffset, scrollOffset + capacity)
  const content =
    sortedPatterns.length > 0
      ? buildTableContent(visible, selectedIndex - scrollOffset, theme)
      : null

  return (
    <box
      flexGrow={1}
      flexShrink={1}
      flexDirection="column"
      width="100%"
      paddingLeft={1}
      paddingRight={1}
      paddingTop={1}
    >
      {content == null ? (
        <box flexGrow={1} flexShrink={1} paddingTop={1}>
          <text content="no slow queries" fg={theme.textMuted} />
        </box>
      ) : (
        <box flexGrow={1} flexShrink={1} width="100%">
          <textTable
            content={content}
            width="100%"
            border
            outerBorder
            borderStyle="single"
            borderColor={theme.border}
            columnWidthMode="content"
            wrapMode="none"
            cellPaddingX={0}
            selectable={false}
          />
        </box>
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
): TextTableContent {
  const header: TextChunk[][] = [
    headerCell('NAMESPACE', theme),
    headerCell('OP', theme),
    headerCell('SHAPE', theme),
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

  return rows
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

  const namespace = padEnd(pattern.namespace, namespaceWidth)

  return [
    selected
      ? cell(namespace, selectedForeground(theme, theme.primary), theme.primary)
      : cell(pattern.namespace, theme.info),
    cell(pattern.op, theme.textMuted),
    cell(truncateShape(pattern.shape), theme.textMuted),
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

function padEnd(text: string, width: number): string {
  if (text.length >= width) return text
  return text + ' '.repeat(width - text.length)
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
