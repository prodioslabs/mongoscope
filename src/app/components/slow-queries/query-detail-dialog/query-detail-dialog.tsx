import { ScrollBoxRenderable, TextAttributes, type RGBA } from '@opentui/core'
import { useBindings, useKeymap } from '@opentui/keymap/react'
import { useTerminalDimensions } from '@opentui/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  getPatternExplain,
  splitNamespace,
  type PatternExplain,
  type QueryPattern,
  type QueryPatternStore,
} from '../../../../query-patterns'
import type { LogStore } from '../../../../parser'
import { getPatternExplainFromSample } from '../../../../profiler'
import { errorMessageText } from '../../../../lib/error-message'
import { type AppKeymapMode } from '../../../lib/keymap-mode'
import { overlayMode } from '../../../lib/overlay-mode'
import { QUERY_DETAIL_SHORTCUTS, queryDetailFooter, toBindings } from '../../../shortcuts'
import { useFooter } from '../../../stores/footer'
import { useSession } from '../../../stores/session'
import { useTheme } from '../../../stores/theme'
import { type Theme } from '../../../theme'
import { Dialog } from '../../ui/dialog'
import {
  avgMsSeverity,
  examinedSeverity,
  formatCount,
  formatExaminedRet,
  planSeverity,
  sparkline,
  type Severity,
} from '../format'

type QueryDetailDialogProps = {
  open: boolean
  pattern: QueryPattern | null
  /** Raw system.profile sample for live explain; preferred over logStore path. */
  sampleDoc?: Record<string, unknown> | null
  logStore?: LogStore | null
  queryPatterns?: QueryPatternStore | null
  onClose: () => void
}

export function QueryDetailDialog({
  open,
  pattern,
  sampleDoc = null,
  logStore = null,
  queryPatterns = null,
  onClose,
}: QueryDetailDialogProps) {
  const theme = useTheme((s) => s.theme)
  const keymap = useKeymap()
  const dimensions = useTerminalDimensions()
  const navigateToTab = useSession((s) => s.navigateToTab)
  const pushOverlayKeybindings = useFooter((s) => s.pushOverlayKeybindings)
  const popOverlayKeybindings = useFooter((s) => s.popOverlayKeybindings)
  const scrollRef = useRef<ScrollBoxRenderable | null>(null)
  const onCloseRef = useRef(onClose)
  const explainRef = useRef<PatternExplain | null>(null)
  const patternRef = useRef(pattern)
  onCloseRef.current = onClose
  patternRef.current = pattern
  const [explain, setExplain] = useState<PatternExplain | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showRaw, setShowRaw] = useState(false)
  explainRef.current = explain

  useEffect(
    function syncQueryDetailOverlayMode() {
      if (!open) return
      overlayMode.acquire('query-detail', keymap)
      return function restoreQueryDetailOverlayMode() {
        overlayMode.release('query-detail', keymap)
      }
    },
    [keymap, open],
  )

  useEffect(
    function syncDetailFooterOverlay() {
      if (!open) return
      pushOverlayKeybindings('query-detail', queryDetailFooter(showRaw))
      return function clearDetailFooterOverlay() {
        popOverlayKeybindings('query-detail')
      }
    },
    [open, showRaw, pushOverlayKeybindings, popOverlayKeybindings],
  )

  useEffect(
    function resetDetailViewWhenClosed() {
      if (open) return
      setShowRaw(false)
    },
    [open],
  )

  useEffect(
    function resetScrollOnContentChange() {
      if (!open) return
      scrollRef.current?.scrollTo(0)
    },
    [open, showRaw, pattern?.id],
  )

  useEffect(
    function loadPatternExplain() {
      if (!open || pattern == null) {
        setExplain(null)
        setLoadError(null)
        return
      }

      let cancelled = false
      setExplain(null)
      setLoadError(null)

      if (sampleDoc != null) {
        try {
          const next = getPatternExplainFromSample(pattern, sampleDoc)
          if (!cancelled) {
            setExplain(next)
          }
        } catch (error: unknown) {
          if (!cancelled) {
            setLoadError(errorMessageText(error))
          }
        }
        return function cancelLoadPatternExplain() {
          cancelled = true
        }
      }

      if (logStore == null || queryPatterns == null) {
        setLoadError('Explain unavailable (no profiler sample)')
        return
      }

      void getPatternExplain(logStore, queryPatterns, pattern.id)
        .then(function applyExplain(next) {
          if (cancelled) {
            return
          }
          setExplain(next)
        })
        .catch(function applyExplainError(error: unknown) {
          if (cancelled) {
            return
          }
          setLoadError(errorMessageText(error))
        })

      return function cancelLoadPatternExplain() {
        cancelled = true
      }
    },
    [open, pattern, sampleDoc, logStore, queryPatterns],
  )

  useBindings(
    function createQueryDetailLayer() {
      return {
        appMode: 'palette' satisfies AppKeymapMode,
        enabled: open,
        priority: 50,
        commands: [
          {
            name: 'query-detail.toggle-raw',
            run() {
              setShowRaw((value) => !value)
            },
          },
          {
            name: 'query-detail.scroll-up',
            run() {
              scrollRef.current?.scrollBy(-1)
            },
          },
          {
            name: 'query-detail.scroll-down',
            run() {
              scrollRef.current?.scrollBy(1)
            },
          },
          {
            name: 'query-detail.page-up',
            run() {
              scrollRef.current?.scrollBy(-1, 'viewport')
            },
          },
          {
            name: 'query-detail.page-down',
            run() {
              scrollRef.current?.scrollBy(1, 'viewport')
            },
          },
          {
            name: 'query-detail.open-indexes',
            run() {
              const current = explainRef.current
              const selectedPattern = patternRef.current
              const suggestion = current?.suggestedIndex ?? null
              const namespace =
                suggestion?.namespace ?? current?.namespace ?? selectedPattern?.namespace ?? ''
              let database = suggestion?.database ?? ''
              let collection = suggestion?.collection ?? ''
              if (database === '' || collection === '') {
                const split = splitNamespace(namespace)
                database = split.db
                collection = split.collection
              }

              if (
                database.trim() === '' ||
                collection.trim() === '' ||
                namespace.trim() === '' ||
                namespace === '—'
              ) {
                return
              }

              navigateToTab('indexes', {
                indexes: {
                  database,
                  collection,
                  suggestedKeyLabel: suggestion?.keyLabel,
                  suggestedCommand: suggestion?.command,
                  suggestedReason: suggestion?.reason,
                  statusMessage:
                    suggestion != null
                      ? `opened indexes for suggested ${suggestion.keyLabel}`
                      : `opened indexes for ${namespace}`,
                },
              })
              onCloseRef.current()
            },
          },
          {
            name: 'query-detail.close',
            run() {
              onCloseRef.current()
            },
          },
        ],
        bindings: toBindings(QUERY_DETAIL_SHORTCUTS),
      }
    },
    [navigateToTab, open],
  )

  const width = Math.min(88, dimensions.width - 4)
  const paddingTop = Math.max(1, Math.floor(dimensions.height / 10))
  // Header row + dialog padding; keep the panel on-screen with a fixed body viewport.
  const bodyHeight = Math.max(8, dimensions.height - paddingTop - 6)

  return (
    <Dialog open={open} onClose={onClose} width={width} paddingTop={paddingTop}>
      <box
        paddingLeft={2}
        paddingRight={2}
        paddingBottom={1}
        gap={1}
        flexDirection="column"
        height={bodyHeight + 3}
        maxHeight={dimensions.height - paddingTop - 1}
      >
        <box flexDirection="row" justifyContent="space-between" flexShrink={0}>
          <text fg={theme.text} attributes={TextAttributes.BOLD}>
            Query detail
          </text>
          <text fg={theme.textMuted} onMouseUp={onClose}>
            esc
          </text>
        </box>

        {pattern == null ? (
          <text fg={theme.textMuted}>No query selected</text>
        ) : loadError != null ? (
          <text fg={theme.error}>{loadError}</text>
        ) : explain == null ? (
          <text fg={theme.textMuted}>Loading…</text>
        ) : (
          <scrollbox
            ref={scrollRef}
            height={bodyHeight}
            width="100%"
            flexGrow={1}
            flexShrink={1}
            scrollX={false}
            scrollY
            backgroundColor={theme.backgroundPanel}
            rootOptions={{ backgroundColor: theme.backgroundPanel }}
            viewportOptions={{ backgroundColor: theme.backgroundPanel }}
            contentOptions={{
              backgroundColor: theme.backgroundPanel,
              flexDirection: 'column',
            }}
            horizontalScrollbarOptions={{ visible: false }}
            verticalScrollbarOptions={{
              trackOptions: {
                foregroundColor: theme.border,
                backgroundColor: theme.backgroundElement,
              },
            }}
          >
            <box width="100%" flexDirection="column" flexShrink={0}>
              {showRaw ? (
                <DetailSection title="Raw sample" theme={theme}>
                  <text fg={theme.text} wrapMode="char">
                    {explain.rawDisplay}
                  </text>
                </DetailSection>
              ) : (
                <>
                  <DetailSection title="Diagnosis" theme={theme}>
                    <DetailRow
                      label="Namespace"
                      value={explain.namespace}
                      valueColor={theme.info}
                    />
                    <DetailRow label="Op" value={explain.op} />
                    <DetailRow
                      label="Plan"
                      value={explain.plan}
                      valueColor={severityColor(theme, planSeverity(explain.plan))}
                    />
                    {explain.planSummary != null && explain.planSummary !== explain.plan ? (
                      <DetailRow label="Plan summary" value={explain.planSummary} />
                    ) : null}
                    <DetailRow
                      label="Duration"
                      value={`${formatCount(explain.totalMillis)} ms`}
                      valueColor={severityColor(theme, avgMsSeverity(explain.totalMillis))}
                    />
                    <DetailRow
                      label="Examined/ret"
                      value={formatExaminedRet(explain.docsExamined, explain.nReturned)}
                      valueColor={severityColor(
                        theme,
                        examinedSeverity(explain.docsExamined, explain.nReturned),
                      )}
                    />
                    <DetailRow label="Stage" value={explain.stageDetail} />
                  </DetailSection>

                  <DetailSection title="Filter / pipeline" theme={theme}>
                    <text fg={theme.text} wrapMode="word">
                      {prettyDisplay(explain.filter)}
                    </text>
                  </DetailSection>

                  {explain.suggestedIndex != null ? (
                    <DetailSection title="Suggested index" theme={theme}>
                      <text fg={theme.success} wrapMode="word">
                        {explain.suggestedIndex.command}
                      </text>
                      <text fg={theme.textMuted} wrapMode="word">
                        {explain.suggestedIndex.reason}
                      </text>
                      <text fg={theme.textMuted} wrapMode="word">
                        Press i to open Indexes for this collection
                      </text>
                    </DetailSection>
                  ) : null}

                  <DetailSection title="Pattern" theme={theme}>
                    <DetailRow label="Count" value={formatCount(pattern.count)} />
                    <DetailRow
                      label="Avg ms"
                      value={formatCount(pattern.avgMs)}
                      valueColor={severityColor(theme, avgMsSeverity(pattern.avgMs))}
                    />
                    <DetailRow label="Total ms" value={formatCount(pattern.totalDurationMs)} />
                    <DetailRow label="Shape" value={pattern.shape} />
                    <DetailRow
                      label="Trend"
                      value={sparkline(pattern.trend)}
                      valueColor={severityColor(theme, avgMsSeverity(pattern.avgMs))}
                    />
                  </DetailSection>

                  <DetailSection title="Context" theme={theme}>
                    <DetailRow label="Timestamp" value={formatTimestamp(explain.timestampMs)} />
                    <DetailRow label="Ctx" value={explain.ctx || 'n/a'} />
                    <DetailRow label="App" value={explain.appName ?? 'n/a'} />
                    <DetailRow label="Remote" value={explain.remote ?? 'n/a'} />
                    <DetailRow label="Protocol" value={explain.protocol ?? 'n/a'} />
                  </DetailSection>

                  <WorkMetricsSection explain={explain} theme={theme} />

                  <DetailSection title="Command" theme={theme}>
                    <text fg={theme.text} wrapMode="word">
                      {explain.commandDisplay}
                    </text>
                  </DetailSection>
                </>
              )}
            </box>
          </scrollbox>
        )}
      </box>
    </Dialog>
  )
}

type WorkMetricsSectionProps = {
  explain: PatternExplain
  theme: Theme
}

function WorkMetricsSection({ explain, theme }: WorkMetricsSectionProps) {
  const rows: { label: string; value: string }[] = []

  if (explain.keysExamined != null) {
    rows.push({ label: 'Keys exam.', value: formatCount(explain.keysExamined) })
  }
  if (explain.numYields != null) {
    rows.push({ label: 'Yields', value: formatCount(explain.numYields) })
  }
  if (explain.reslen != null) {
    rows.push({ label: 'Reslen', value: formatCount(explain.reslen) })
  }
  if (explain.cpuNanos != null) {
    rows.push({ label: 'CPU', value: formatCpu(explain.cpuNanos) })
  }
  if (explain.workingMillis != null) {
    rows.push({ label: 'Working', value: `${formatCount(explain.workingMillis)} ms` })
  }
  if (explain.waitForWriteConcernDurationMillis != null) {
    rows.push({
      label: 'WC wait',
      value: `${formatCount(explain.waitForWriteConcernDurationMillis)} ms`,
    })
  }

  if (rows.length === 0) return null

  return (
    <DetailSection title="Work" theme={theme}>
      {rows.map((row) => (
        <DetailRow key={row.label} label={row.label} value={row.value} />
      ))}
    </DetailSection>
  )
}

type DetailSectionProps = {
  title: string
  theme: Theme
  children?: ReactNode
}

function DetailSection({ title, theme, children }: DetailSectionProps) {
  return (
    <box flexDirection="column" gap={0} paddingBottom={1}>
      <text fg={theme.accent} attributes={TextAttributes.BOLD}>
        {title}
      </text>
      <box flexDirection="column" paddingTop={0}>
        {children}
      </box>
    </box>
  )
}

type DetailRowProps = {
  label: string
  value: string
  valueColor?: RGBA
}

function DetailRow({ label, value, valueColor }: DetailRowProps) {
  const theme = useTheme((s) => s.theme)
  return (
    <box flexDirection="row" gap={1}>
      <text fg={theme.textMuted} width={14} flexShrink={0}>
        {label}
      </text>
      <text fg={valueColor ?? theme.text} wrapMode="word" flexGrow={1}>
        {value}
      </text>
    </box>
  )
}

function prettyDisplay(value: string): string {
  if (value === 'n/a') return value
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    return value
  }
}

function formatTimestamp(timestampMs: number): string {
  if (!Number.isFinite(timestampMs)) return 'n/a'
  return new Date(timestampMs).toISOString()
}

function formatCpu(cpuNanos: number): string {
  if (cpuNanos >= 1_000_000) {
    return `${(cpuNanos / 1_000_000).toFixed(1)} ms`
  }
  if (cpuNanos >= 1_000) {
    return `${(cpuNanos / 1_000).toFixed(0)} µs`
  }
  return `${formatCount(cpuNanos)} ns`
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
