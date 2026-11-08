'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { docsRoute } from '@/lib/shared'
import { DemoCard, KeyChip } from './demo-card'
import {
  formatClock,
  logCategories,
  logTemplates,
  type LogCategory,
  type LogTemplate,
} from './demo-data'
import { Kbd } from './kbd'
import { Screen, ScreenFooter, severityTone, tone } from './terminal'

type LogLine = LogTemplate & {
  id: number
  /** Seconds since midnight. */
  time: number
}

const streamMs = 1300
const visibleLines = 7
const maxLines = 200
const startTime = 12 * 3600 + 4 * 60 + 11

const initialLines: LogLine[] = logTemplates.slice(0, visibleLines).map((template, index) => ({
  ...template,
  id: index,
  time: startTime + index * 2,
}))

type LogsDemoProps = {
  className?: string
}

export function LogsDemo({ className }: LogsDemoProps) {
  const [lines, setLines] = useState(initialLines)
  const [enabled, setEnabled] = useState<ReadonlySet<LogCategory>>(
    () => new Set(logCategories.map(({ category }) => category)),
  )
  const [search, setSearch] = useState('')
  /** Id of the newest line when the stream was paused; null while following. */
  const [pausedAt, setPausedAt] = useState<number | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(function streamLogLines() {
    const timer = window.setInterval(() => {
      const template = logTemplates[Math.floor(Math.random() * logTemplates.length)]
      const gap = 1 + Math.floor(Math.random() * 3)
      if (!template) return
      setLines((previous) => {
        const last = previous[previous.length - 1]
        const line = {
          ...template,
          id: (last?.id ?? 0) + 1,
          time: (last?.time ?? startTime) + gap,
        }
        return [...previous, line].slice(-maxLines)
      })
    }, streamMs)
    return () => window.clearInterval(timer)
  }, [])

  const query = search.trim().toLowerCase()
  const matches = (line: LogLine) =>
    enabled.has(line.category) &&
    (!query || `${line.category} ${line.message}`.toLowerCase().includes(query))
  const matching = lines.filter(matches)
  const shown = (
    pausedAt === null ? matching : matching.filter((line) => line.id <= pausedAt)
  ).slice(-visibleLines)
  const pending = pausedAt === null ? 0 : matching.filter((line) => line.id > pausedAt).length

  function toggleFollow() {
    setPausedAt((paused) => (paused === null ? (lines[lines.length - 1]?.id ?? 0) : null))
  }

  function toggleCategory(category: LogCategory) {
    setEnabled((previous) => {
      const next = new Set(previous)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  }

  return (
    <DemoCard
      id="logs"
      tabKey="5"
      title="Logs"
      badge="Static + Live"
      docsHref={`${docsRoute}/logs`}
      description={
        <>
          Tail the analysed log file, or poll <code className="font-mono text-[0.9em]">getLog</code>{' '}
          live. Toggle components, search, and pause the stream with <Kbd>space</Kbd>.
        </>
      }
      keys={{
        space: toggleFollow,
        '/': () => searchRef.current?.focus(),
        ...Object.fromEntries(
          logCategories.map(({ key, category }) => [key, () => toggleCategory(category)]),
        ),
      }}
      keyHints={['space', '/', 'c', 'w', 'r', 'n', 's']}
      controls={
        <>
          {logCategories.map(({ key, category }) => (
            <KeyChip
              key={category}
              hotkey={key}
              active={enabled.has(category)}
              onClick={() => toggleCategory(category)}
            >
              <span className={cn(!enabled.has(category) && 'line-through opacity-60')}>
                {category}
              </span>
            </KeyChip>
          ))}
          <label className="relative inline-flex items-center">
            <span className="sr-only">Search log messages</span>
            <Kbd className="pointer-events-none absolute left-1.5">/</Kbd>
            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') event.currentTarget.blur()
              }}
              placeholder="search messages"
              className="w-47.5 max-w-[52vw] rounded-lg border border-fd-border bg-fd-background py-0.5 pr-2 pl-7 text-[0.8125rem] outline-none focus-visible:ring-2 focus-visible:ring-(--home-accent)"
            />
          </label>
          <KeyChip hotkey="space" active={pausedAt === null} onClick={toggleFollow}>
            {pausedAt === null ? 'following' : 'paused'}
          </KeyChip>
        </>
      }
      className={className}
    >
      <Screen>
        <div className="flex h-38.5 flex-col justify-end overflow-hidden">
          {shown.length > 0 ? (
            shown.map((line) => (
              <div
                key={line.id}
                className="overflow-hidden leading-5.5 text-ellipsis whitespace-pre animate-ms-rise"
              >
                <span className={tone.muted}>{formatClock(line.time)}</span>
                {'  '}
                <span className={severityTone(line.severity)}>{line.severity}</span>
                {'  '}
                <span className={tone.primary}>{line.category.padEnd(8)}</span>{' '}
                <Highlighted text={line.message} query={query} />
              </div>
            ))
          ) : (
            <p className={tone.muted}>
              No lines match. Turn a component back on or clear the search.
            </p>
          )}
        </div>
        <ScreenFooter>
          {pausedAt === null ? (
            <>
              <span className={tone.success}>●</span> following · {enabled.size}/
              {logCategories.length} components
              {query ? ` · matching “${search.trim()}”` : null}
            </>
          ) : (
            <>
              <span className={tone.warning}>❚❚</span> paused ·{' '}
              <span className={tone.warning}>
                {pending} new line{pending === 1 ? '' : 's'}
              </span>{' '}
              · press space to follow
            </>
          )}
        </ScreenFooter>
      </Screen>
    </DemoCard>
  )
}

type HighlightedProps = {
  text: string
  query: string
}

function Highlighted({ text, query }: HighlightedProps) {
  const index = query ? text.toLowerCase().indexOf(query) : -1
  if (index < 0) return text

  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded-sm bg-(--tui-warning)/40 text-inherit">
        {text.slice(index, index + query.length)}
      </mark>
      {text.slice(index + query.length)}
    </>
  )
}
