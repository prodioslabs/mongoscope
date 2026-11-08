'use client'

import Link from 'next/link'
import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { docsRoute } from '@/lib/shared'
import { previewTabs } from './demo-data'
import { useHomeActions, useHomeState, type GlobalKey } from './home-provider'
import { Kbd } from './kbd'
import { HomeSection, SectionHeading } from './section'
import { TerminalButton, TerminalCursor, TerminalWindow, tone } from './terminal'

const miniTabLabels = ['1 Slow', '2 Live', '3 Repl', '4 Indexes', '5 Logs'] as const

const tabKeys: Array<{ tab: string; keys: string[] }> = [
  { tab: 'Slow Queries', keys: ['c', 'a', 'p', 'x'] },
  { tab: 'Live Ops', keys: ['x', 'e'] },
  { tab: 'Indexes', keys: ['s', 'o', '[', ']'] },
  { tab: 'Logs', keys: ['space', '/', 'f'] },
]

export function KeyboardSection() {
  const { tabIndex, tuiTheme, keyLog, quitState, pressedKeys, shortcutsEnabled, colorMode } =
    useHomeState()
  const { runKey, answerQuit, restart, setShortcutsEnabled, setMiniTerminalVisible } =
    useHomeActions()
  const terminalRef = useRef<HTMLDivElement>(null)

  useEffect(
    function trackMiniTerminalVisibility() {
      const terminal = terminalRef.current
      if (!terminal) return
      const observer = new IntersectionObserver(
        ([entry]) => setMiniTerminalVisible(entry?.isIntersecting ?? false),
        { threshold: 0.4 },
      )
      observer.observe(terminal)
      return () => {
        observer.disconnect()
        setMiniTerminalVisible(false)
      }
    },
    [setMiniTerminalVisible],
  )

  function keycap(
    key: GlobalKey,
    label: string,
    options: { pressedAs?: string[]; wide?: boolean } = {},
  ) {
    const pressed = (options.pressedAs ?? [key]).some((name) => pressedKeys.has(name))
    return (
      <Keycap
        key={label}
        label={label}
        wide={options.wide}
        pressed={pressed}
        onPress={() => runKey(key)}
      />
    )
  }

  return (
    <HomeSection id="shortcuts" labelledBy="shortcuts-heading">
      <SectionHeading
        id="shortcuts-heading"
        eyebrow="Keyboard first"
        title="Never reach for the mouse."
        description={
          <>
            MongoScope’s global keys work on this page too. Go on, press <Kbd>t</Kbd>, or click a
            key.
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <div className="grid gap-5 rounded-[1.125rem] border border-fd-border bg-linear-to-b from-white to-fd-background dark:from-fd-secondary dark:to-fd-card p-5.5">
          <KeyGroup title="Move around">
            <KeyItem label="jump to a tab">
              {(['1', '2', '3', '4', '5'] as const).map((key) => keycap(key, key))}
            </KeyItem>
            <KeyItem label="next tab">{keycap('tab', 'Tab', { wide: true })}</KeyItem>
          </KeyGroup>
          <KeyGroup title="Make it yours">
            <KeyItem
              label={
                <>
                  light / dark ·{' '}
                  <b className="font-medium text-fd-foreground">{colorMode ?? '…'}</b>
                </>
              }
            >
              {keycap('m', 'm')}
            </KeyItem>
            <KeyItem
              label={
                <>
                  cycle theme · <b className="font-medium text-fd-foreground">{tuiTheme}</b>
                </>
              }
            >
              {keycap('t', 't')}
            </KeyItem>
          </KeyGroup>
          <KeyGroup title="Everything else">
            <KeyItem label="command palette · searches the docs here">
              {keycap('ctrl+k', 'Ctrl', { pressedAs: ['ctrl'], wide: true })}
              <span className="text-[0.8125rem] text-fd-muted-foreground">+</span>
              {keycap('ctrl+k', 'K', { pressedAs: ['k'] })}
            </KeyItem>
            <KeyItem label="help">{keycap('?', '?')}</KeyItem>
            <KeyItem label="quit">{keycap('q', 'q')}</KeyItem>
          </KeyGroup>
        </div>

        <div ref={terminalRef} className="flex min-w-0">
          <TerminalWindow
            className="flex w-full flex-col"
            title={`mongoscope · ${previewTabs[tabIndex]} · ${tuiTheme}${colorMode ? ` · ${colorMode}` : ''}`}
          >
            <div className="flex gap-3.5 overflow-hidden border-b border-(--tui-border)/60 px-3.5 py-1 whitespace-nowrap text-(--tui-muted)">
              {miniTabLabels.map((label, index) => (
                <span key={label} className={cn(index === tabIndex && tone.accent)}>
                  {label}
                </span>
              ))}
            </div>
            <div aria-live="polite" className="min-h-49 flex-1 px-3.5 py-2.5">
              {quitState === 'confirm' ? (
                <div className="flex flex-col items-start gap-2">
                  <span className={tone.warning}>Quit mongoscope?</span>
                  <div className="flex gap-2">
                    <TerminalButton onClick={() => answerQuit(true)}>
                      <span className={tone.error}>y</span> quit
                    </TerminalButton>
                    <TerminalButton onClick={() => answerQuit(false)}>
                      <span className={tone.accent}>n</span> stay
                    </TerminalButton>
                  </div>
                </div>
              ) : null}
              {quitState === 'exited' ? (
                <div className="flex flex-col items-start gap-2">
                  <span className={tone.muted}>[mongoscope exited with code 0]</span>
                  <span>
                    <span className={tone.accent}>~</span> $ <TerminalCursor />
                  </span>
                  <TerminalButton onClick={restart}>↻ run mongoscope again</TerminalButton>
                  <span className={tone.muted}>or press any key</span>
                </div>
              ) : null}
              {quitState === 'idle' && keyLog.length === 0 ? (
                <p className={tone.muted}>
                  Waiting for a key… try <span className={tone.accent}>t</span>,{' '}
                  <span className={tone.accent}>m</span> or <span className={tone.accent}>1</span>–
                  <span className={tone.accent}>5</span>
                </p>
              ) : null}
              {quitState === 'idle'
                ? keyLog.map((entry, index) => (
                    <div
                      key={entry.id}
                      className={cn('truncate', index === keyLog.length - 1 && 'animate-ms-rise')}
                      style={{ opacity: 0.4 + 0.6 * ((index + 1) / keyLog.length) }}
                    >
                      <span className={tone.accent}>›</span>{' '}
                      <span className={cn('inline-block min-w-14', tone.warning)}>{entry.key}</span>
                      {entry.message}
                    </div>
                  ))
                : null}
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-(--tui-border)/60 px-3.5 py-1.5 text-(--tui-muted)">
              <span className="truncate">? help · ctrl+k palette · q quit</span>
              <TerminalCursor />
            </div>
          </TerminalWindow>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[0.8125rem] text-fd-muted-foreground">
          <b className="font-medium text-fd-foreground">Inside tabs:</b>
          {tabKeys.map(({ tab, keys }) => (
            <span key={tab} className="inline-flex items-center gap-1">
              {tab}
              {keys.map((key) => (
                <Kbd key={key}>{key}</Kbd>
              ))}
            </span>
          ))}
          <Link
            href={`${docsRoute}/shortcuts`}
            className="font-medium text-(--home-accent-ink) underline-offset-4 hover:underline"
          >
            All shortcuts →
          </Link>
        </div>
        <label
          className="inline-flex cursor-pointer items-center gap-2.5 text-[0.8125rem] text-fd-muted-foreground"
          title="Single-key shortcuts can be switched off (WCAG 2.1.4)"
        >
          <input
            type="checkbox"
            role="switch"
            checked={shortcutsEnabled}
            onChange={(event) => setShortcutsEnabled(event.target.checked)}
            className="relative h-5 w-8.5 cursor-pointer appearance-none rounded-full bg-fd-border transition-colors after:absolute after:top-0.75 after:left-0.75 after:size-3.5 after:rounded-full after:bg-white after:transition-transform checked:bg-(--home-accent) checked:after:translate-x-3.5"
          />
          Page shortcuts
        </label>
      </div>
    </HomeSection>
  )
}

type KeyGroupProps = {
  title: string
  children: ReactNode
}

function KeyGroup({ title, children }: KeyGroupProps) {
  return (
    <div>
      <p className="mb-2.5 text-[0.6875rem] font-semibold tracking-[0.07em] text-fd-muted-foreground uppercase">
        {title}
      </p>
      <div className="flex flex-wrap gap-x-6.5 gap-y-4">{children}</div>
    </div>
  )
}

type KeyItemProps = {
  label: ReactNode
  children: ReactNode
}

function KeyItem({ label, children }: KeyItemProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
      <span className="text-[0.8125rem] text-fd-muted-foreground">{label}</span>
    </div>
  )
}

type KeycapProps = {
  label: string
  pressed: boolean
  wide?: boolean
  onPress: () => void
}

function Keycap({ label, pressed, wide = false, onPress }: KeycapProps) {
  return (
    <button
      type="button"
      onClick={onPress}
      className={cn(
        'inline-grid h-11.5 place-items-center rounded-[10px] border px-3 font-mono font-semibold transition-[translate,box-shadow,background-color,color,border-color] duration-75 select-none active:translate-y-0.75',
        wide ? 'min-w-18.5 text-[0.8125rem]' : 'min-w-11.5 text-[0.9375rem]',
        pressed
          ? 'translate-y-0.75 border-(--home-accent) bg-(--home-accent-soft) text-(--home-accent-ink) shadow-[0_0_0_4px_var(--home-accent-soft)]'
          : 'border-fd-border bg-linear-to-b from-white to-fd-secondary/70 dark:from-fd-card dark:to-fd-secondary shadow-[0_3px_0_0_var(--color-fd-border),0_8px_16px_-10px_rgb(0_0_0/0.45)] hover:border-(--home-accent)/50',
      )}
    >
      {label}
    </button>
  )
}
