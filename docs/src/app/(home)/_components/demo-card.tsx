'use client'

import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/utils'
import { useHomeActions } from './home-provider'
import { Kbd } from './kbd'

/** Key → action while the card is hovered or focused (same keys as the TUI tab). */
export type DemoKeys = Record<string, () => void>

const PressedKeyContext = createContext<string | null>(null)

/** Last key routed to the enclosing demo card, for press feedback on its controls. */
export function usePressedKey() {
  return use(PressedKeyContext)
}

type DemoCardProps = {
  id: string
  tabKey: string
  title: string
  badge: string
  badgeHighlight?: boolean
  docsHref: string
  description: ReactNode
  keys: DemoKeys
  /** Keys listed in the header while the card's keys are live. */
  keyHints: string[]
  controls?: ReactNode
  /** Changing this replays the "jumped here" highlight. */
  flashToken?: number
  className?: string
  children: ReactNode
}

export function DemoCard({
  id,
  tabKey,
  title,
  badge,
  badgeHighlight = false,
  docsHref,
  description,
  keys,
  keyHints,
  controls,
  flashToken = 0,
  className,
  children,
}: DemoCardProps) {
  const { claimKeys } = useHomeActions()
  const cardRef = useRef<HTMLElement>(null)
  const keysRef = useRef(keys)
  const [keysLive, setKeysLive] = useState(false)
  const [pressed, setPressed] = useState<{ key: string; at: number } | null>(null)

  useEffect(function syncLatestKeys() {
    keysRef.current = keys
  })

  useEffect(
    function releasePressedKey() {
      if (!pressed) return
      const timer = window.setTimeout(() => setPressed(null), 160)
      return () => window.clearTimeout(timer)
    },
    [pressed],
  )

  useEffect(
    function releaseKeysOnUnmount() {
      return () => claimKeys(id, null)
    },
    [claimKeys, id],
  )

  const handleKey = useCallback((key: string) => {
    const run = keysRef.current[key]
    if (!run) return false
    run()
    setPressed({ key, at: Date.now() })
    return true
  }, [])

  function activate() {
    claimKeys(id, handleKey)
    setKeysLive(true)
  }

  function deactivate() {
    claimKeys(id, null)
    setKeysLive(false)
  }

  function moveSpotlight(event: PointerEvent<HTMLElement>) {
    const card = cardRef.current
    if (!card) return
    const rect = card.getBoundingClientRect()
    card.style.setProperty('--mx', `${event.clientX - rect.left}px`)
    card.style.setProperty('--my', `${event.clientY - rect.top}px`)
  }

  return (
    <article
      ref={cardRef}
      id={`${id}-demo`}
      aria-labelledby={`${id}-demo-title`}
      onPointerMove={moveSpotlight}
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') activate()
      }}
      onPointerLeave={deactivate}
      onFocus={activate}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) deactivate()
      }}
      className={cn(
        'group/card relative isolate flex min-w-0 flex-col gap-3 overflow-hidden rounded-2xl border border-fd-border bg-tui-card p-4.5 shadow-[0_1px_2px_var(--tui-shadow-soft)] transition-[box-shadow,translate] duration-300 sm:p-5',
        'hover:-translate-y-0.5 hover:shadow-[0_24px_48px_-28px_var(--tui-shadow-strong)] focus-within:-translate-y-0.5',
        // Cursor spotlight: soft fill plus a lit border ring that follows the pointer.
        'before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:bg-[radial-gradient(480px_circle_at_var(--mx,50%)_var(--my,-40%),var(--home-accent-soft),transparent_45%)] before:opacity-0 before:transition-opacity before:duration-300 hover:before:opacity-100 focus-within:before:opacity-100',
        'after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:bg-[radial-gradient(260px_circle_at_var(--mx,50%)_var(--my,-40%),var(--home-accent),transparent_70%)] after:p-px after:opacity-0 after:transition-opacity after:duration-300 after:[mask:linear-gradient(#000_0_0)_content-box_exclude,linear-gradient(#000_0_0)] hover:after:opacity-100',
        className,
      )}
    >
      {flashToken > 0 ? (
        <span
          key={flashToken}
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] animate-ms-flash"
        />
      ) : null}

      <header className="flex min-h-7 items-center gap-2.5">
        <Kbd className="min-w-6 rounded-md text-xs">{tabKey}</Kbd>
        <h3 id={`${id}-demo-title`} className="font-semibold tracking-tight">
          {title}
        </h3>
        <span
          className={cn(
            'rounded-full border px-2 py-0.5 text-[0.6875rem] font-medium whitespace-nowrap',
            badgeHighlight
              ? 'border-(--home-accent)/40 bg-(--home-accent-soft) text-(--home-accent-ink)'
              : 'border-fd-border text-fd-muted-foreground',
          )}
        >
          {badge}
        </span>
        <span
          aria-hidden={!keysLive}
          className={cn(
            'ml-auto hidden items-center gap-1 text-xs whitespace-nowrap text-fd-muted-foreground transition-[opacity,translate] duration-200 pointer-fine:sm:flex',
            keysLive ? 'translate-x-0 opacity-100' : 'translate-x-1.5 opacity-0',
          )}
        >
          <span className="mr-1 size-1.5 rounded-full bg-(--home-accent) shadow-[0_0_0_3px_var(--home-accent-soft)]" />
          keys live:
          {keyHints.map((hint) => (
            <Kbd key={hint}>{hint}</Kbd>
          ))}
        </span>
        <Link
          href={docsHref}
          className="group/docs ml-auto inline-flex items-center gap-1 text-[0.8125rem] font-medium whitespace-nowrap text-(--home-accent-ink) pointer-fine:sm:ml-3"
        >
          Docs
          <ArrowRight
            className="size-3.5 transition-transform group-hover/docs:translate-x-0.5"
            aria-hidden
          />
        </Link>
      </header>

      <p className="text-sm text-pretty text-fd-muted-foreground">{description}</p>

      <PressedKeyContext value={pressed?.key ?? null}>
        {controls ? <div className="flex flex-wrap items-center gap-1.5">{controls}</div> : null}
        {children}
      </PressedKeyContext>
    </article>
  )
}

type KeyChipProps = {
  hotkey: string
  active?: boolean
  danger?: boolean
  onClick: () => void
  children: ReactNode
}

/** Control that mirrors a TUI key: shows the key, presses down when the key is used. */
export function KeyChip({
  hotkey,
  active = false,
  danger = false,
  onClick,
  children,
}: KeyChipProps) {
  const pressed = usePressedKey() === hotkey

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border py-0.5 pr-2.5 pl-1 text-[0.8125rem] font-medium transition-[color,background-color,border-color,scale,translate] duration-150',
        active
          ? 'border-(--home-accent)/55 bg-(--home-accent-soft) text-(--home-accent-ink)'
          : 'border-fd-border bg-fd-background hover:bg-fd-accent',
        danger && !active && 'hover:border-(--tui-error)/50 hover:text-(--tui-error)',
        pressed && 'translate-y-px scale-[0.97]',
      )}
    >
      <Kbd>{hotkey}</Kbd>
      {children}
    </button>
  )
}

type ControlLabelProps = {
  children: ReactNode
}

export function ControlLabel({ children }: ControlLabelProps) {
  return <span className="mr-0.5 text-xs text-fd-muted-foreground">{children}</span>
}
