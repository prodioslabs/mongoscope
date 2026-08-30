import { type TextChunk, type TextTableContent } from '@opentui/core'
import { useBindings } from '@opentui/keymap/react'
import { useRenderer, useTerminalDimensions } from '@opentui/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { findBestMatchingPattern } from '../../../../query-patterns'
import {
  formatRunningMs,
  runningMsSeverity,
  truncateLiveOpsCell,
  type CurrentOpRow,
  type KillOpTarget,
  type LiveOpsPanelError,
} from '../../../../live-ops'
import { displayText } from '../../../../lib/display-text'
import {
  computeTableCapacity,
  headerCell,
  padTableRows,
  severityColor,
  tableCell,
} from '../../../lib/text-table-content'
import { type AppKeymapMode } from '../../../lib/keymap-mode'
import { whenNotEditing } from '../../../lib/when-not-editing'
import { useKillCurrentOp } from '../../../queries/kill-op'
import { LIVE_OPS_FOOTER, LIVE_OPS_SHORTCUTS, toBindings } from '../../../shortcuts'
import { useSession } from '../../../stores/session'
import { useTheme } from '../../../stores/theme'
import { type Theme } from '../../../theme'
import { DataTextTable } from '../../data-text-table'
import { useFooterKeybindings, useFooterStatus } from '../../footer-keybindings'
import { planSeverity } from '../../slow-queries/format'
import { KillOpConfirmDialog } from '../kill-op-confirm-dialog'

type CurrentOpsTableProps = {
  ops: CurrentOpRow[]
  error: LiveOpsPanelError | null
  ownOpsOnly: boolean
  lockNote: string
  /** When true, sidebar stacks below the table — reserve extra vertical chrome. */
  stackedLayout?: boolean
}

const STATUS_CLEAR_MS = 3000
const EMPTY_OPID = '—'

/**
 * Non-data lines above/below the currentOp table within Live Ops:
 * tab bar, footer, DbSelector, dashboard header, collection top, borders/padding.
 */
const LIVE_OPS_CHROME_ROWS = 18
const LIVE_OPS_STACKED_CHROME_ROWS = 26

export function CurrentOpsTable({
  ops,
  error,
  ownOpsOnly,
  lockNote,
  stackedLayout = false,
}: CurrentOpsTableProps) {
  const renderer = useRenderer()
  const theme = useTheme((s) => s.theme)
  const queryPatterns = useSession((s) => s.queryPatterns)
  const navigateToTab = useSession((s) => s.navigateToTab)
  const { height: terminalHeight } = useTerminalDimensions()
  const killMutation = useKillCurrentOp()

  const [selectedOpid, setSelectedOpid] = useState<string | null>(null)
  const [scrollOffset, setScrollOffset] = useState(0)
  const [killTarget, setKillTarget] = useState<KillOpTarget | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const selectedOpidRef = useRef<string | null>(null)
  const scrollOffsetRef = useRef(0)
  const capacityRef = useRef(1)
  const opsRef = useRef(ops)
  const killInFlightOpidRef = useRef<string | null>(null)
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const chromeRows = stackedLayout ? LIVE_OPS_STACKED_CHROME_ROWS : LIVE_OPS_CHROME_ROWS
  const capacity = computeTableCapacity(chromeRows, terminalHeight)
  const killConfirmOpen = killTarget != null
  const notEditing = whenNotEditing(renderer)

  selectedOpidRef.current = selectedOpid
  scrollOffsetRef.current = scrollOffset
  capacityRef.current = capacity
  opsRef.current = ops

  const showFooter = error == null && !killConfirmOpen
  useFooterKeybindings(showFooter ? LIVE_OPS_FOOTER : [])
  useFooterStatus(statusMessage)

  const showTransientStatus = useCallback(function showTransientStatus(message: string) {
    setStatusMessage(message)
    if (statusTimerRef.current != null) {
      clearTimeout(statusTimerRef.current)
    }
    statusTimerRef.current = setTimeout(function clearTransientStatus() {
      setStatusMessage(null)
      statusTimerRef.current = null
    }, STATUS_CLEAR_MS)
  }, [])

  useEffect(
    function cleanupStatusTimer() {
      return function disposeStatusTimer() {
        if (statusTimerRef.current != null) {
          clearTimeout(statusTimerRef.current)
        }
      }
    },
    [],
  )

  useEffect(
    function reconcileSelectionAfterPoll() {
      if (selectedOpid == null) {
        return
      }
      const index = ops.findIndex((op) => op.opid === selectedOpid)
      if (index < 0) {
        setSelectedOpid(null)
        showTransientStatus('selected operation ended')
        return
      }
      setScrollOffset((offset) => {
        if (index < offset) {
          return index
        }
        if (index >= offset + capacity) {
          return index - capacity + 1
        }
        return offset
      })
    },
    [capacity, ops, selectedOpid, showTransientStatus],
  )

  useEffect(
    function clearSelectionWhenEmpty() {
      if (ops.length === 0) {
        setSelectedOpid(null)
        setScrollOffset(0)
      }
    },
    [ops.length],
  )

  useEffect(
    function clampScrollOffset() {
      setScrollOffset((offset) => {
        if (ops.length === 0) {
          return 0
        }
        const maxOffset = Math.max(0, ops.length - capacity)
        return Math.min(offset, maxOffset)
      })
    },
    [capacity, ops.length],
  )

  useBindings(
    function createLiveOpsTableLayer() {
      function resolveSelectedIndex(currentOps: CurrentOpRow[], opid: string | null): number {
        if (opid == null) {
          return -1
        }
        return currentOps.findIndex((op) => op.opid === opid)
      }

      function moveSelection(delta: number) {
        const currentOps = opsRef.current
        const length = currentOps.length
        if (length === 0) {
          return
        }

        let prev = resolveSelectedIndex(currentOps, selectedOpidRef.current)
        if (prev < 0) {
          prev = delta > 0 ? -1 : length
        }

        const next = Math.max(0, Math.min(length - 1, prev + delta))
        const nextOp = currentOps[next]
        if (nextOp == null) {
          return
        }

        setSelectedOpid(nextOp.opid)

        const cap = capacityRef.current
        const offset = scrollOffsetRef.current
        if (next < offset) {
          setScrollOffset(next)
        } else if (next >= offset + cap) {
          setScrollOffset(next - cap + 1)
        }
      }

      function selectedRow(): CurrentOpRow | null {
        const currentOps = opsRef.current
        const opid = selectedOpidRef.current
        if (opid == null) {
          return null
        }
        return currentOps.find((op) => op.opid === opid) ?? null
      }

      function openKillConfirm() {
        const row = selectedRow()
        if (row == null) {
          return
        }
        if (row.opid === EMPTY_OPID) {
          showTransientStatus('cannot kill: missing op id')
          return
        }
        setKillTarget({
          opid: row.opid,
          namespace: row.namespace,
          op: row.op,
          plan: row.plan,
          client: row.client,
          runningMs: row.runningMs,
        })
      }

      function jumpToExplain() {
        const row = selectedRow()
        if (row == null) {
          return
        }

        const patterns = queryPatterns?.patterns ?? []
        if (queryPatterns == null || patterns.length === 0) {
          showTransientStatus('no slow query log loaded')
          return
        }

        const match = findBestMatchingPattern(patterns, {
          namespace: row.namespace,
          op: row.op,
          plan: row.plan,
        })

        if (match != null) {
          navigateToTab('slow-queries', {
            slowQueries: {
              patternId: match.id,
              openDetail: true,
              statusMessage: `opened explain for ${row.namespace} ${row.op}`,
            },
          })
        } else {
          navigateToTab('slow-queries', {
            slowQueries: {
              statusMessage: `no matching slow query pattern for ${row.namespace} ${row.op}`,
            },
          })
        }
      }

      return {
        appMode: 'base' satisfies AppKeymapMode,
        enabled: function liveOpsTableEnabled() {
          return !killConfirmOpen && notEditing()
        },
        commands: [
          {
            name: 'live-ops.move-up',
            run() {
              moveSelection(-1)
            },
          },
          {
            name: 'live-ops.move-down',
            run() {
              moveSelection(1)
            },
          },
          {
            name: 'live-ops.kill-open',
            run() {
              openKillConfirm()
            },
          },
          {
            name: 'live-ops.jump-explain',
            run() {
              jumpToExplain()
            },
          },
        ],
        bindings: toBindings(LIVE_OPS_SHORTCUTS),
      }
    },
    [killConfirmOpen, navigateToTab, notEditing, queryPatterns, showTransientStatus],
  )

  const handleKillConfirm = useCallback(
    function confirmKillOperation() {
      if (killTarget == null || killMutation.isPending) {
        return
      }
      if (killInFlightOpidRef.current != null) {
        return
      }

      const stillLive = opsRef.current.some((op) => op.opid === killTarget.opid)
      if (!stillLive) {
        setKillTarget(null)
        setSelectedOpid(null)
        showTransientStatus('operation already finished')
        return
      }

      killInFlightOpidRef.current = killTarget.opid
      const opid = killTarget.opid

      killMutation.mutate(opid, {
        onSuccess(result) {
          setKillTarget(null)
          if (result.ok) {
            setSelectedOpid(null)
            showTransientStatus(`kill requested for op ${opid}`)
          } else {
            showTransientStatus(result.message)
          }
        },
        onError() {
          setKillTarget(null)
          showTransientStatus('could not kill operation')
        },
        onSettled() {
          killInFlightOpidRef.current = null
        },
      })
    },
    [killMutation, killTarget, showTransientStatus],
  )

  if (error != null) {
    return (
      <box flexGrow={1} flexDirection="column" gap={0}>
        <text content={displayText(error.message)} fg={theme.error} />
      </box>
    )
  }

  const resolvedIndex =
    selectedOpid == null ? -1 : ops.findIndex((op) => op.opid === selectedOpid)
  const visible = ops.slice(scrollOffset, scrollOffset + capacity)
  const relativeSelectedIndex =
    resolvedIndex >= scrollOffset && resolvedIndex < scrollOffset + capacity
      ? resolvedIndex - scrollOffset
      : -1

  const content = buildCurrentOpTableContent(
    visible,
    relativeSelectedIndex,
    theme,
    capacity,
  )
  const isEmpty = ops.length === 0

  return (
    <box flexGrow={1} flexShrink={1} flexDirection="column" gap={0}>
      {ownOpsOnly ? (
        <text content="showing own operations only" fg={theme.warning} />
      ) : null}
      <DataTextTable content={content} theme={theme} />
      {isEmpty ? (
        <box flexShrink={0} paddingTop={0}>
          <text content="no active operations" fg={theme.textMuted} />
        </box>
      ) : null}
      {lockNote.trim() !== '' ? (
        <text content={displayText(lockNote)} fg={theme.warning} />
      ) : null}
      <KillOpConfirmDialog
        open={killConfirmOpen}
        target={killTarget}
        isPending={killMutation.isPending}
        onConfirm={handleKillConfirm}
        onCancel={function cancelKillOperation() {
          if (!killMutation.isPending) {
            setKillTarget(null)
          }
        }}
      />
    </box>
  )
}

function buildCurrentOpTableContent(
  ops: CurrentOpRow[],
  selectedIndex: number,
  theme: Theme,
  rowCapacity: number,
): TextTableContent {
  const header: TextChunk[][] = [
    headerCell('OPID', theme),
    headerCell('NAMESPACE', theme),
    headerCell('OP', theme),
    headerCell('PLAN', theme),
    headerCell('RUNNING (MS)', theme),
    headerCell('LOCK', theme),
    headerCell('WAITINGFOR', theme),
    headerCell('CLIENT', theme),
  ]

  const rows: TextTableContent = [header]

  for (let i = 0; i < ops.length; i++) {
    const op = ops[i]!
    const selected = i === selectedIndex
    rows.push(buildCurrentOpRow(op, selected, theme))
  }

  return padTableRows(rows, rowCapacity)
}

function buildCurrentOpRow(op: CurrentOpRow, selected: boolean, theme: Theme): TextChunk[][] {
  const runningSeverity = runningMsSeverity(op.runningMs)
  const runningColor =
    runningSeverity === 'normal'
      ? theme.text
      : severityColor(theme, runningSeverity)

  const namespaceLabel = truncateLiveOpsCell(op.namespace, 20)
  const namespaceCell = selected
    ? tableCell(`${namespaceLabel} ●`, theme.primary)
    : tableCell(namespaceLabel, theme.text)

  return [
    tableCell(truncateLiveOpsCell(op.opid, 10), theme.text),
    namespaceCell,
    tableCell(truncateLiveOpsCell(op.op, 8), theme.text),
    tableCell(displayPlan(op.plan), severityColor(theme, planSeverity(op.plan))),
    tableCell(formatRunningMs(op.runningMs), runningColor),
    tableCell(truncateLiveOpsCell(op.lock, 14), theme.textMuted),
    tableCell(truncateLiveOpsCell(op.waitingFor, 14), theme.textMuted),
    tableCell(truncateLiveOpsCell(op.client, 18), theme.textMuted),
  ]
}

function displayPlan(plan: string): string {
  if (plan === 'n/a') {
    return '—'
  }
  return plan
}
