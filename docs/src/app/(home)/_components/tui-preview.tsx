'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { previewTabDefs, slowPatterns, sortSlowPatterns } from './demo-data'
import { useHomeActions, useHomeState } from './home-provider'
import { Kbd } from './kbd'
import {
  latencyTone,
  planTone,
  severityTone,
  TerminalCursor,
  TerminalWindow,
  tone,
} from './terminal'

const footerKeys = [
  'c count · a avg · p plan · enter details · x export · l live',
  'x kill op · e explain · c connections',
  'c connections · auto-refresh 5s',
  '←/→ database · [/] collection · s size · o ops',
  'space follow · / search · f filter · c w r n s pills',
] as const

/** Hero preview of the five dashboard tabs; tab and theme are shared with the keyboard section. */
export function TuiPreview() {
  const { tabIndex, tuiTheme } = useHomeState()
  const { selectTab } = useHomeActions()

  return (
    <div className="relative isolate">
      <div
        aria-hidden
        className="absolute inset-x-[6%] top-[10%] bottom-[-6%] -z-10 bg-[radial-gradient(closest-side,var(--home-accent-soft),transparent)] blur-2xl"
      />
      <TerminalWindow
        title={
          <>
            mongoscope · {previewTabDefs[tabIndex].name} · {tuiTheme}
          </>
        }
      >
        <div
          role="tablist"
          aria-label="MongoScope dashboard tabs"
          className="flex gap-0.5 overflow-x-auto border-b border-(--tui-border)/60 px-2.5 pt-1.5 scrollbar-none"
        >
          {previewTabDefs.map((tab, index) => (
            <button
              key={tab.name}
              id={`preview-tab-${index}`}
              type="button"
              role="tab"
              aria-selected={index === tabIndex}
              aria-controls="preview-panel"
              onClick={() => selectTab(index)}
              className={cn(
                'border-b-2 px-2.5 py-0.5 whitespace-nowrap transition-colors',
                index === tabIndex
                  ? 'border-(--tui-accent) text-(--tui-accent)'
                  : 'border-transparent text-(--tui-muted) hover:text-(--tui-fg)',
              )}
            >
              {index + 1} {tab.name}
            </button>
          ))}
        </div>
        <div
          id="preview-panel"
          role="tabpanel"
          aria-labelledby={`preview-tab-${tabIndex}`}
          className="min-h-52 overflow-x-auto px-3.5 py-2.5"
        >
          {tabIndex === 0 ? <SlowQueriesView /> : null}
          {tabIndex === 1 ? <LiveOpsView /> : null}
          {tabIndex === 2 ? <ReplicationView /> : null}
          {tabIndex === 3 ? <IndexesView /> : null}
          {tabIndex === 4 ? <LogsView /> : null}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-(--tui-border)/60 px-3.5 py-1.5 text-(--tui-muted)">
          <span className="truncate">{footerKeys[tabIndex]}</span>
          <TerminalCursor />
        </div>
      </TerminalWindow>
      <p className="mt-3.5 text-center text-[0.8125rem] text-fd-muted-foreground">
        Click a tab or press <Kbd>1</Kbd>–<Kbd>5</Kbd> · <Kbd>t</Kbd> cycles the app’s real themes
      </p>
    </div>
  )
}

type PreviewTableProps = {
  head: string[]
  children: ReactNode
}

function PreviewTable({ head, children }: PreviewTableProps) {
  return (
    <table className="w-full border-collapse whitespace-nowrap">
      <thead>
        <tr>
          {head.map((cell) => (
            <th
              key={cell}
              className={cn(
                'pr-4 text-left font-normal',
                cell.endsWith('▾') ? tone.accent : tone.muted,
              )}
            >
              {cell}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="[&_td]:pr-4">{children}</tbody>
    </table>
  )
}

const trend: Record<string, string> = {
  'app.orders': '▁▃▅▇█▆▃',
  'app.users': '▁▂▄▃▂▂▁',
  'app.sessions': '▁▁▂▁▁▁▁',
  'billing.invoices': '▁▂▁▃▁▁▂',
}

function SlowQueriesView() {
  return (
    <PreviewTable head={['NAMESPACE', 'OP', 'COUNT', 'AVG MS ▾', 'PLAN', 'TREND']}>
      {sortSlowPatterns('avg').map((pattern, index) => (
        <tr key={pattern.namespace} className={cn(index === 0 && 'bg-(--tui-panel)')}>
          <td className={tone.info}>{pattern.namespace}</td>
          <td className={tone.muted}>{pattern.op === 'aggregate' ? 'agg' : pattern.op}</td>
          <td>{pattern.count.toLocaleString('en-US')}</td>
          <td className={latencyTone(pattern.avgMs)}>{pattern.avgMs}</td>
          <td className={planTone(pattern.plan)}>{pattern.plan}</td>
          <td className={index === 0 ? tone.warning : tone.muted}>{trend[pattern.namespace]}</td>
        </tr>
      ))}
    </PreviewTable>
  )
}

function LiveOpsView() {
  const [seconds, setSeconds] = useState(14)

  useEffect(function tickLongestOp() {
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <>
      <PreviewTable head={['OPID', 'NS', 'OP', 'SECS', 'PLAN', 'CLIENT']}>
        <tr className="bg-(--tui-panel)">
          <td>48211</td>
          <td className={tone.info}>app.orders</td>
          <td className={tone.muted}>find</td>
          <td className={tone.error}>{seconds}</td>
          <td className={tone.error}>COLLSCAN</td>
          <td className={tone.muted}>10.0.4.21</td>
        </tr>
        <tr>
          <td>48219</td>
          <td className={tone.info}>app.users</td>
          <td className={tone.muted}>update</td>
          <td className={tone.warning}>3</td>
          <td className={tone.success}>IXSCAN</td>
          <td className={tone.muted}>10.0.4.9</td>
        </tr>
        <tr>
          <td>48224</td>
          <td className={tone.info}>app.carts</td>
          <td className={tone.muted}>aggregate</td>
          <td className={tone.muted}>1</td>
          <td className={tone.success}>IXSCAN</td>
          <td className={tone.muted}>10.0.4.12</td>
        </tr>
      </PreviewTable>
      <p className={cn('mt-2', tone.muted)}>3 active · 1 queued · 1 lock wait</p>
    </>
  )
}

function ReplicationView() {
  return (
    <>
      <PreviewTable head={['MEMBER', 'STATE', 'LAG', 'PRI / VOTES', 'PING']}>
        <tr>
          <td>
            <span className={tone.success}>●</span> rs0-a:27017
          </td>
          <td className={tone.accent}>PRIMARY</td>
          <td className={tone.muted}>—</td>
          <td className={tone.muted}>1 / 1</td>
          <td className={tone.muted}>—</td>
        </tr>
        <tr>
          <td>
            <span className={tone.muted}>├─</span> <span className={tone.success}>●</span>{' '}
            rs0-b:27017
          </td>
          <td className={tone.primary}>SECONDARY</td>
          <td className={tone.success}>0.4s</td>
          <td className={tone.muted}>1 / 1</td>
          <td className={tone.muted}>1ms</td>
        </tr>
        <tr className="bg-(--tui-panel)">
          <td>
            <span className={tone.muted}>└─</span> <span className={tone.warning}>●</span>{' '}
            rs0-c:27017
          </td>
          <td className={tone.primary}>SECONDARY</td>
          <td className={tone.error}>18.2s</td>
          <td className={tone.muted}>0 / 1</td>
          <td className={tone.muted}>42ms</td>
        </tr>
      </PreviewTable>
      <p className="mt-2">
        <span className={tone.muted}>oplog</span> 41h 12m window{' '}
        <span className={tone.success}>██████</span>
        <span className={tone.muted}>░░░░</span> 62%
      </p>
    </>
  )
}

function IndexesView() {
  return (
    <>
      <p className={cn('mb-1', tone.muted)}>
        app ▸ <span className={tone.info}>orders</span> · 4 indexes
      </p>
      <PreviewTable head={['INDEX', 'OPS', 'SIZE', 'STATUS']}>
        <tr>
          <td className={tone.info}>_id_</td>
          <td>2.1M</td>
          <td className={tone.muted}>48 MB</td>
          <td className={tone.muted}>—</td>
        </tr>
        <tr>
          <td className={tone.info}>customerId_1</td>
          <td>884k</td>
          <td className={tone.muted}>31 MB</td>
          <td className={tone.muted}>—</td>
        </tr>
        <tr>
          <td className={tone.info}>createdAt_-1</td>
          <td className={tone.warning}>12k</td>
          <td className={tone.muted}>40 MB</td>
          <td className={tone.muted}>—</td>
        </tr>
        <tr className="bg-(--tui-panel)">
          <td className={tone.info}>status_1_createdAt_-1</td>
          <td className={tone.muted}>0</td>
          <td className={tone.muted}>—</td>
          <td className={tone.warning}>BUILD 64% ▓▓▓▓▓▓░░░</td>
        </tr>
      </PreviewTable>
    </>
  )
}

const previewLogLines = [
  {
    time: '12:04:11',
    severity: 'I',
    category: 'NETWORK',
    message: 'Connection accepted from 10.0.4.21',
  },
  {
    time: '12:04:12',
    severity: 'W',
    category: 'COMMAND',
    message: 'Slow query app.orders 842ms COLLSCAN',
  },
  {
    time: '12:04:12',
    severity: 'I',
    category: 'STORAGE',
    message: 'WiredTiger checkpoint complete',
  },
  { time: '12:04:15', severity: 'W', category: 'REPL', message: 'rs0-c is 18s behind the primary' },
  { time: '12:04:16', severity: 'I', category: 'WRITE', message: 'Slow update app.sessions 48ms' },
] as const

function LogsView() {
  return (
    <div className="whitespace-pre">
      {previewLogLines.map((line) => (
        <div key={`${line.time}-${line.category}`}>
          <span className={tone.muted}>{line.time}</span>{' '}
          <span className={severityTone(line.severity)}>{line.severity}</span>{' '}
          <span className={tone.primary}>{line.category.padEnd(8)}</span> {line.message}
        </div>
      ))}
      <p className={cn('mt-1', tone.muted)}>
        {slowPatterns.length} slow-query patterns · following
      </p>
    </div>
  )
}
