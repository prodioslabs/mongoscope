'use client'

import { Fragment, useEffect, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { docsRoute, latestRelease } from '@/lib/shared'
import { DemoCard, KeyChip, usePressedKey } from './demo-card'
import { slowPatterns, sortSlowPatterns, type SlowPattern, type SlowSort } from './demo-data'
import { useFeatureDemos } from './feature-demos-context'
import { Screen, ScreenFooter, tone } from './terminal'

type ExportFormat = 'json' | 'csv' | 'md'
type WriteStatus = 'idle' | 'writing' | 'written'

const formats: Array<{ format: ExportFormat; label: string }> = [
  { format: 'json', label: 'JSON' },
  { format: 'csv', label: 'CSV' },
  { format: 'md', label: 'Markdown' },
]

const sortLabel: Record<SlowSort, string> = {
  count: 'count',
  avg: 'avg ms',
  plan: 'plan',
}

export function ExportDemo() {
  const { slowSort } = useFeatureDemos()
  const [format, setFormat] = useState<ExportFormat>('json')
  const [status, setStatus] = useState<WriteStatus>('idle')

  useEffect(
    function advanceWriteStatus() {
      if (status === 'idle') return
      const timer = window.setTimeout(
        () => setStatus(status === 'writing' ? 'written' : 'idle'),
        status === 'writing' ? 500 : 3500,
      )
      return () => window.clearTimeout(timer)
    },
    [status],
  )

  function cycleFormat() {
    const index = formats.findIndex((option) => option.format === format)
    setFormat(formats[(index + 1) % formats.length]?.format ?? 'json')
  }

  const fileName = `./slow-queries.${format}`
  const rows = sortSlowPatterns(slowSort)

  return (
    <DemoCard
      id="export"
      tabKey="x"
      title="Export"
      badge={`New in v${latestRelease.version}`}
      badgeHighlight
      docsHref={`${docsRoute}/slow-queries`}
      description="Writes every pattern to JSON, CSV or Markdown, in your current sort order (try re-sorting Slow Queries). Credentials and URIs are never included."
      keys={{ f: cycleFormat, x: () => setStatus('writing') }}
      keyHints={['f', 'x']}
      controls={
        <>
          <FormatSwitch format={format} onChange={setFormat} />
          <KeyChip hotkey="x" onClick={() => setStatus('writing')}>
            write file
          </KeyChip>
        </>
      }
    >
      <Screen>
        <pre className="min-h-42 font-mono text-[0.71875rem] leading-relaxed whitespace-pre">
          {format === 'json' ? <JsonPreview rows={rows} /> : null}
          {format === 'csv' ? <CsvPreview rows={rows} /> : null}
          {format === 'md' ? <MarkdownPreview rows={rows} /> : null}
        </pre>
        <ScreenFooter className={cn(status === 'written' && tone.success)}>
          {status === 'writing'
            ? 'writing…'
            : status === 'written'
              ? `✓ wrote ${slowPatterns.length} patterns → ${fileName}`
              : `${fileName} · by ${sortLabel[slowSort]}`}
        </ScreenFooter>
      </Screen>
    </DemoCard>
  )
}

type FormatSwitchProps = {
  format: ExportFormat
  onChange: (format: ExportFormat) => void
}

function FormatSwitch({ format, onChange }: FormatSwitchProps) {
  const pressed = usePressedKey() === 'f'

  return (
    <div
      role="group"
      aria-label="Export format (f)"
      className={cn(
        'inline-flex rounded-[9px] border border-fd-border bg-fd-secondary p-0.5 transition-[scale] duration-150',
        pressed && 'scale-[0.98]',
      )}
    >
      {formats.map((option) => (
        <button
          key={option.format}
          type="button"
          aria-pressed={format === option.format}
          onClick={() => onChange(option.format)}
          className={cn(
            'rounded-[7px] px-2.5 py-0.5 text-[0.8125rem] font-medium transition-colors',
            format === option.format
              ? 'bg-fd-background text-fd-foreground shadow-sm'
              : 'text-fd-muted-foreground hover:text-fd-foreground',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

type PreviewProps = {
  rows: SlowPattern[]
}

type JsonField =
  | { key: string; kind: 'string'; value: string }
  | { key: string; kind: 'number'; value: number }

function JsonPreview({ rows }: PreviewProps) {
  const first = rows[0]
  if (!first) {
    return null
  }
  const fields: JsonField[] = [
    { key: 'namespace', kind: 'string', value: first.namespace },
    { key: 'op', kind: 'string', value: first.op },
    { key: 'count', kind: 'number', value: first.count },
    { key: 'avgMs', kind: 'number', value: first.avgMs },
    { key: 'plan', kind: 'string', value: first.plan },
  ]

  return (
    <>
      {'[\n  {\n'}
      {fields.map((field, index) => (
        <Fragment key={field.key}>
          {'    '}
          <span className={tone.primary}>"{field.key}"</span>:{' '}
          {field.kind === 'number' ? (
            <span className={tone.warning}>{field.value}</span>
          ) : (
            <span className={tone.success}>"{field.value}"</span>
          )}
          {index < fields.length - 1 ? ',' : ''}
          {'\n'}
        </Fragment>
      ))}
      {'  },\n'}
      <span className={tone.muted}>{`  … ${rows.length - 1} more patterns`}</span>
      {'\n]'}
    </>
  )
}

function CsvPreview({ rows }: PreviewProps) {
  return (
    <>
      <span className={tone.muted}>namespace,op,count,avg_ms,plan</span>
      {rows.map((row) => `\n${row.namespace},${row.op},${row.count},${row.avgMs},${row.plan}`)}
    </>
  )
}

function MarkdownPreview({ rows }: PreviewProps) {
  const columns: Array<[string, (row: SlowPattern) => string]> = [
    ['namespace', (row) => row.namespace],
    ['avg ms', (row) => String(row.avgMs)],
    ['plan', (row) => row.plan],
  ]
  const widths = columns.map(([heading, cell]) =>
    Math.max(heading.length, ...rows.map((row) => cell(row).length)),
  )

  function line(cells: string[]): ReactNode {
    return cells.map((value, index) => (
      <Fragment key={index}>
        <span className={tone.muted}>| </span>
        {value.padEnd(widths[index] ?? 0)}{' '}
        {index === cells.length - 1 ? <span className={tone.muted}>|</span> : null}
      </Fragment>
    ))
  }

  return (
    <>
      {line(columns.map(([heading]) => heading))}
      {'\n'}
      <span className={tone.muted}>
        {`|${widths.map((width) => '-'.repeat(width + 2)).join('|')}|`}
      </span>
      {rows.map((row) => (
        <Fragment key={row.namespace}>
          {'\n'}
          {line(columns.map(([, cell]) => cell(row)))}
        </Fragment>
      ))}
    </>
  )
}
