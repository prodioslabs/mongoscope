import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Static Slow Queries mockup — update when TUI columns change. */
export function TuiMockup() {
  return (
    <div
      data-tui-mock
      className="overflow-hidden rounded-xl border border-(--tui-border) shadow-lg"
      style={tuiPaletteStyle}
      aria-hidden
    >
      <div className="flex items-center gap-2 border-b border-(--tui-border) bg-(--tui-panel) px-3 py-2">
        <span className="size-2.5 rounded-full bg-(--tui-error) opacity-80" />
        <span className="size-2.5 rounded-full bg-(--tui-warning) opacity-80" />
        <span className="size-2.5 rounded-full bg-(--tui-success) opacity-80" />
        <span className="ml-2 font-mono text-xs text-(--tui-muted)">
          mongoscope · Slow Queries · static
        </span>
      </div>

      <div className="overflow-x-auto bg-(--tui-bg) p-3 font-mono text-[11px] leading-5 text-(--tui-fg) sm:text-xs sm:leading-5">
        <div className="mb-2 flex flex-wrap gap-x-3 text-(--tui-muted)">
          <span>1 Slow Queries</span>
          <span>2 Live Ops</span>
          <span>3 Replication</span>
          <span>4 Indexes</span>
          <span>5 Logs</span>
        </div>

        <div className="mb-1 border-t border-(--tui-border)" />

        <div className="min-w-xl">
          <Row muted>
            <span>NAMESPACE</span>
            <span>OP</span>
            <span>COUNT</span>
            <span className="text-(--tui-fg)">AVG MS ▾</span>
            <span>EXAMINED/RET</span>
            <span>PLAN</span>
            <span>TREND</span>
          </Row>

          <Row>
            <span className="text-(--tui-info)">app.orders</span>
            <span className="text-(--tui-muted)">find</span>
            <span>1,248</span>
            <span className="text-(--tui-error)">842</span>
            <span className="text-(--tui-muted)">4.2M / 12</span>
            <span className="text-(--tui-error)">COLLSCAN</span>
            <span className="text-(--tui-muted)">▁▂▅▇█▇▅▃</span>
          </Row>

          <Row>
            <span className="text-(--tui-info)">app.users</span>
            <span className="text-(--tui-muted)">agg</span>
            <span>386</span>
            <span className="text-(--tui-warning)">214</span>
            <span className="text-(--tui-muted)">98k / 386</span>
            <span className="text-(--tui-warning)">IXSCAN+SORT</span>
            <span className="text-(--tui-muted)">▂▃▄▅▄▃▂▁</span>
          </Row>

          <Row>
            <span className="text-(--tui-primary)">app.sessions ●</span>
            <span className="text-(--tui-muted)">update</span>
            <span>912</span>
            <span className="text-(--tui-muted)">48</span>
            <span className="text-(--tui-muted)">912 / 912</span>
            <span className="text-(--tui-success)">IXSCAN</span>
            <span className="text-(--tui-muted)">▁▁▂▃▂▁▁▁</span>
          </Row>

          <Row>
            <span className="text-(--tui-info)">billing.invoices</span>
            <span className="text-(--tui-muted)">find</span>
            <span>54</span>
            <span className="text-(--tui-warning)">160</span>
            <span className="text-(--tui-muted)">12k / 54</span>
            <span className="text-(--tui-success)">IXSCAN</span>
            <span className="text-(--tui-muted)">▁▂▁▃▂▁▁▂</span>
          </Row>
        </div>

        <div className="mt-1 border-t border-(--tui-border)" />

        <div className="mt-2 flex items-center justify-between gap-3 text-(--tui-muted)">
          <span>c count · a avg · p plan · enter details · i indexes</span>
          <span className="text-(--tui-fg)">
            ▌<span className="animate-pulse">_</span>
          </span>
        </div>
      </div>
    </div>
  )
}

/** Gruvbox-dark palette matching the default TUI theme. */
const tuiPaletteStyle = {
  '--tui-bg': '#282828',
  '--tui-panel': '#3c3836',
  '--tui-border': '#504945',
  '--tui-fg': '#ebdbb2',
  '--tui-muted': '#928374',
  '--tui-primary': '#83a598',
  '--tui-info': '#fabd2f',
  '--tui-error': '#fb4934',
  '--tui-warning': '#fe8019',
  '--tui-success': '#b8bb26',
} as CSSProperties

type RowProps = {
  children: ReactNode
  muted?: boolean
}

function Row({ children, muted = false }: RowProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-[minmax(9rem,1.4fr)_3.5rem_4rem_5rem_7rem_7rem_5rem] gap-x-2 py-0.5',
        muted && 'text-(--tui-muted)',
      )}
    >
      {children}
    </div>
  )
}
