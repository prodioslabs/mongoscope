import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { LogSeverity, PlanSummary } from './demo-data'

/** Text tones from the active TUI palette (`--tui-*`, set by `HomeProvider`). */
export const tone = {
  fg: 'text-(--tui-fg)',
  muted: 'text-(--tui-muted)',
  primary: 'text-(--tui-primary)',
  accent: 'text-(--tui-accent)',
  info: 'text-(--tui-info)',
  success: 'text-(--tui-success)',
  warning: 'text-(--tui-warning)',
  error: 'text-(--tui-error)',
} as const

export function planTone(plan: PlanSummary) {
  if (plan === 'COLLSCAN') {
    return tone.error
  }
  if (plan === 'IXSCAN+SORT') {
    return tone.warning
  }
  return tone.success
}

export function latencyTone(ms: number) {
  if (ms >= 500) {
    return tone.error
  }
  if (ms >= 150) {
    return tone.warning
  }
  return tone.muted
}

export function secondsTone(seconds: number) {
  if (seconds >= 10) {
    return tone.error
  }
  if (seconds >= 3) {
    return tone.warning
  }
  return tone.muted
}

export function lagTone(seconds: number) {
  if (seconds < 2) {
    return tone.success
  }
  if (seconds < 10) {
    return tone.warning
  }
  return tone.error
}

export function severityTone(severity: LogSeverity) {
  if (severity === 'E') {
    return tone.error
  }
  if (severity === 'W') {
    return tone.warning
  }
  return tone.success
}

type TerminalWindowProps = {
  title: ReactNode
  className?: string
  children: ReactNode
}

export function TerminalWindow({ title, className, children }: TerminalWindowProps) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-(--tui-border) bg-(--tui-bg) font-mono text-xs leading-6 text-(--tui-fg) shadow-[0_24px_48px_-28px_var(--tui-shadow)] dark:shadow-[0_30px_60px_-24px_var(--tui-shadow)] transition-colors duration-300',
        className,
      )}
    >
      <div className="flex items-center gap-1.5 bg-(--tui-panel) px-3 py-2 text-(--tui-muted) transition-colors duration-300">
        <span className="size-2.5 shrink-0 rounded-full bg-(--tui-error) opacity-80" />
        <span className="size-2.5 shrink-0 rounded-full bg-(--tui-warning) opacity-80" />
        <span className="size-2.5 shrink-0 rounded-full bg-(--tui-success) opacity-80" />
        <span className="ml-2 min-w-0 truncate">{title}</span>
      </div>
      {children}
    </div>
  )
}

export function TerminalCursor() {
  return (
    <span aria-hidden className="inline-block h-[1.1em] w-1.75 animate-ms-blink bg-(--tui-fg)" />
  )
}

type ScreenProps = {
  className?: string
  children: ReactNode
}

/** Terminal-styled panel inside a demo card; scrolls sideways on narrow screens. */
export function Screen({ className, children }: ScreenProps) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-1 flex-col overflow-x-auto rounded-lg border border-(--tui-border)/60 bg-(--tui-bg) p-3 font-mono text-xs leading-relaxed text-(--tui-fg) transition-colors duration-300',
        className,
      )}
    >
      {children}
    </div>
  )
}

type ScreenFooterProps = {
  className?: string
  children: ReactNode
}

export function ScreenFooter({ className, children }: ScreenFooterProps) {
  return (
    <div
      className={cn(
        'mt-auto truncate border-t border-dashed border-(--tui-border)/60 pt-2 text-(--tui-muted)',
        className,
      )}
    >
      {children}
    </div>
  )
}

type TerminalButtonProps = {
  onClick: () => void
  label?: string
  className?: string
  children: ReactNode
}

export function TerminalButton({ onClick, label, className, children }: TerminalButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        'rounded-md border border-(--tui-border) bg-(--tui-panel) px-2 leading-5 text-(--tui-fg) transition-colors hover:border-(--tui-accent)',
        className,
      )}
    >
      {children}
    </button>
  )
}
