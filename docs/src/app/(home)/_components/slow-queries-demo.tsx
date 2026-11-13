'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { docsRoute } from '@/lib/shared'
import { ControlLabel, DemoCard, KeyChip } from './demo-card'
import { slowPatterns, sortSlowPatterns, type SlowSort } from './demo-data'
import { useFeatureDemos } from './feature-demos-context'
import { latencyTone, planTone, Screen, tone } from './terminal'

const sortOptions: Array<{ sort: SlowSort; key: string; label: string }> = [
  { sort: 'count', key: 'c', label: 'count' },
  { sort: 'avg', key: 'a', label: 'avg ms' },
  { sort: 'plan', key: 'p', label: 'plan' },
]

const rowHeightPx = 30
const maxAvgMs = Math.max(...slowPatterns.map((pattern) => pattern.avgMs))
const rowGrid =
  'grid grid-cols-[minmax(7.5rem,1.5fr)_4.75rem_3.75rem_6.75rem_6.5rem] items-center gap-2 px-2'

type SlowQueriesDemoProps = {
  className?: string
}

export function SlowQueriesDemo({ className }: SlowQueriesDemoProps) {
  const { slowSort, setSlowSort, showIndexes } = useFeatureDemos()
  const [selectedNamespace, setSelectedNamespace] = useState(slowPatterns[0]?.namespace)

  const ordered = sortSlowPatterns(slowSort)
  const selected =
    slowPatterns.find((pattern) => pattern.namespace === selectedNamespace) ?? slowPatterns[0]

  function moveSelection(delta: number) {
    const index = ordered.findIndex((pattern) => pattern.namespace === selectedNamespace)
    const next = ordered[Math.min(ordered.length - 1, Math.max(0, index + delta))]
    if (next) {
      setSelectedNamespace(next.namespace)
    }
  }

  function openSuggestedIndex() {
    if (selected?.suggestedIndex) {
      showIndexes(selected.namespace)
    }
  }

  return (
    <DemoCard
      id="slow-queries"
      tabKey="1"
      title="Slow Queries"
      badge="Static + Live"
      docsHref={`${docsRoute}/slow-queries`}
      description="Groups slow log lines into query shapes. Sort by count, avg ms, plan, or regression (`g`, static). Open a row for details — History compares early vs late in the current log tail."
      keys={{
        c: () => setSlowSort('count'),
        a: () => setSlowSort('avg'),
        p: () => setSlowSort('plan'),
        j: () => moveSelection(1),
        k: () => moveSelection(-1),
        i: openSuggestedIndex,
      }}
      keyHints={['c', 'a', 'p', 'j', 'k', 'i']}
      controls={
        <>
          <ControlLabel>Sort</ControlLabel>
          {sortOptions.map((option) => (
            <KeyChip
              key={option.sort}
              hotkey={option.key}
              active={slowSort === option.sort}
              onClick={() => setSlowSort(option.sort)}
            >
              {option.label}
            </KeyChip>
          ))}
        </>
      }
      className={className}
    >
      <Screen>
        <div className="min-w-124">
          <div className={cn(rowGrid, 'pb-1', tone.muted)}>
            <span>NAMESPACE</span>
            <span>OP</span>
            <SortedHeading active={slowSort === 'count'}>COUNT</SortedHeading>
            <SortedHeading active={slowSort === 'avg'}>AVG MS</SortedHeading>
            <SortedHeading active={slowSort === 'plan'}>PLAN</SortedHeading>
          </div>

          {/* Rows slide to their new position when the sort changes. */}
          <div className="relative" style={{ height: rowHeightPx * slowPatterns.length }}>
            {slowPatterns.map((pattern) => {
              const position = ordered.indexOf(pattern)
              const isSelected = pattern === selected
              return (
                <button
                  key={pattern.namespace}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedNamespace(pattern.namespace)}
                  style={{
                    height: rowHeightPx,
                    transform: `translateY(${position * rowHeightPx}px)`,
                  }}
                  className={cn(
                    rowGrid,
                    'absolute inset-x-0 top-0 rounded-md text-left transition-[transform,background-color] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
                    isSelected ? 'bg-(--tui-panel)' : 'hover:bg-(--tui-panel)/55',
                  )}
                >
                  <span className={cn('truncate', tone.info)}>
                    {pattern.namespace}
                    {isSelected ? <span className={tone.accent}> ●</span> : null}
                  </span>
                  <span className={tone.muted}>{pattern.op}</span>
                  <span>{pattern.count.toLocaleString('en-US')}</span>
                  <span className={cn('flex items-center gap-2', latencyTone(pattern.avgMs))}>
                    <span
                      className="h-1.5 rounded-full bg-current opacity-85"
                      style={{ width: Math.max(4, Math.round((pattern.avgMs / maxAvgMs) * 54)) }}
                    />
                    {pattern.avgMs}
                  </span>
                  <span className={planTone(pattern.plan)}>{pattern.plan}</span>
                </button>
              )
            })}
          </div>

          {selected ? (
            <dl className="mt-2 grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 gap-y-0.5 border-t border-dashed border-(--tui-border)/60 px-2 pt-2">
              <dt className={tone.muted}>filter</dt>
              <dd className="truncate">{selected.filter}</dd>
              <dt className={tone.muted}>examined/ret</dt>
              <dd>{selected.examinedReturned}</dd>
              <dt className={tone.muted}>suggested</dt>
              <dd className="flex flex-wrap items-center gap-x-3">
                {selected.suggestedIndex ? (
                  <>
                    <span className={tone.success}>{selected.suggestedIndex}</span>
                    <button
                      type="button"
                      onClick={openSuggestedIndex}
                      className={cn('underline decoration-dotted underline-offset-3', tone.accent)}
                    >
                      i · open in Indexes ↓
                    </button>
                  </>
                ) : (
                  <span className={tone.muted}>an existing index already covers this shape</span>
                )}
              </dd>
            </dl>
          ) : null}
        </div>
      </Screen>
    </DemoCard>
  )
}

type SortedHeadingProps = {
  active: boolean
  children: string
}

function SortedHeading({ active, children }: SortedHeadingProps) {
  return (
    <span className={cn(active && tone.accent)}>
      {children}
      {active ? ' ▾' : null}
    </span>
  )
}
