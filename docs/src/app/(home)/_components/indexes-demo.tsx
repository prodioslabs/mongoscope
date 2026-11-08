'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { docsRoute } from '@/lib/shared'
import { ControlLabel, DemoCard, KeyChip } from './demo-card'
import { buildingIndex, formatOps, indexInventory, slowPatterns } from './demo-data'
import { useFeatureDemos } from './feature-demos-context'
import { Screen, TerminalButton, tone } from './terminal'

type IndexSort = 'size' | 'ops'

const buildTickMs = 700
/** Ticks the finished index stays "ready" before the build demo restarts. */
const readyTicks = 13
const collections = Object.keys(indexInventory)
const indexGrid = 'grid h-6.5 grid-cols-[minmax(0,1fr)_4.75rem_2.875rem] items-center gap-2 px-1.5'

type BuildState = {
  /** Percent while building; null once ready. */
  progress: number | null
  readyFor: number
}

export function IndexesDemo() {
  const { indexesCollection, setIndexesCollection, indexesFlash } = useFeatureDemos()
  const [sort, setSort] = useState<IndexSort>('size')
  const [build, setBuild] = useState<BuildState>({ progress: 18, readyFor: 0 })

  useEffect(function advanceIndexBuild() {
    const timer = window.setInterval(() => {
      const step = 1 + Math.floor(Math.random() * 4)
      setBuild((previous) => {
        if (previous.progress === null) {
          return previous.readyFor >= readyTicks
            ? { progress: 6, readyFor: 0 }
            : { progress: null, readyFor: previous.readyFor + 1 }
        }
        const progress = previous.progress + step
        return progress >= 100 ? { progress: null, readyFor: 0 } : { progress, readyFor: 0 }
      })
    }, buildTickMs)
    return () => window.clearInterval(timer)
  }, [])

  function stepCollection(delta: number) {
    const index = collections.indexOf(indexesCollection)
    const next = collections[(index + delta + collections.length) % collections.length]
    if (next) {
      setIndexesCollection(next)
    }
  }

  const inventory = [...(indexInventory[indexesCollection] ?? [])]
  const hasBuild = indexesCollection === buildingIndex.collection
  if (hasBuild && build.progress === null) {
    inventory.push({ name: buildingIndex.name, ops: 0, sizeMb: buildingIndex.sizeMb })
  }
  inventory.sort((a, b) => (sort === 'size' ? b.sizeMb - a.sizeMb : b.ops - a.ops))
  const maxOps = Math.max(1, ...inventory.map((entry) => entry.ops))
  const suggestion = slowPatterns.find(
    (pattern) => pattern.namespace === indexesCollection && pattern.suggestedIndex,
  )

  return (
    <DemoCard
      id="indexes"
      tabKey="4"
      title="Indexes"
      badge="Live"
      docsHref={`${docsRoute}/indexes`}
      description={
        <>
          Sizes, <code className="font-mono text-[0.9em]">$indexStats</code> ops and in-progress
          builds, plus the index Slow Queries suggests.
        </>
      }
      keys={{
        s: () => setSort('size'),
        o: () => setSort('ops'),
        '[': () => stepCollection(-1),
        ']': () => stepCollection(1),
      }}
      keyHints={['s', 'o', '[', ']']}
      flashToken={indexesFlash}
      controls={
        <>
          <ControlLabel>Sort</ControlLabel>
          <KeyChip hotkey="s" active={sort === 'size'} onClick={() => setSort('size')}>
            size
          </KeyChip>
          <KeyChip hotkey="o" active={sort === 'ops'} onClick={() => setSort('ops')}>
            ops
          </KeyChip>
        </>
      }
    >
      <Screen>
        <div className="flex min-w-67.5 flex-1 flex-col">
          <div className="mb-1.5 flex items-center gap-1.5">
            <TerminalButton label="Previous collection" onClick={() => stepCollection(-1)}>
              [
            </TerminalButton>
            <span className={tone.info}>{indexesCollection}</span>
            <TerminalButton label="Next collection" onClick={() => stepCollection(1)}>
              ]
            </TerminalButton>
            <span className={cn('ml-auto', tone.muted)}>
              {collections.indexOf(indexesCollection) + 1}/{collections.length}
            </span>
          </div>

          <div className={cn(indexGrid, tone.muted)}>
            <span>INDEX</span>
            <span>OPS</span>
            <span>SIZE</span>
          </div>
          {inventory.map((entry) => (
            <div key={entry.name} className={indexGrid}>
              <span className={cn('truncate', tone.info)}>{entry.name}</span>
              <span className="flex items-center gap-1.5">
                <span
                  className="h-1.5 rounded-full bg-(--tui-primary) opacity-80"
                  style={{ width: Math.max(2, Math.round((entry.ops / maxOps) * 28)) }}
                />
                <span className={cn(entry.ops === 0 && tone.muted)}>{formatOps(entry.ops)}</span>
              </span>
              <span className={tone.muted}>{entry.sizeMb}MB</span>
            </div>
          ))}
          {hasBuild && build.progress !== null ? (
            <div className={indexGrid}>
              <span className={cn('truncate', tone.info)}>{buildingIndex.name}</span>
              <span className="block h-1.75 w-15.5 overflow-hidden rounded-full bg-(--tui-warning)/25">
                <span
                  className="block h-full bg-(--tui-warning) transition-[width] duration-500"
                  style={{ width: `${build.progress}%` }}
                />
              </span>
              <span className={tone.warning}>{build.progress}%</span>
            </div>
          ) : null}

          {suggestion?.suggestedIndex ? (
            <p className="mt-2 rounded-md border border-dashed border-(--tui-accent)/55 px-2 py-1.5">
              <span className={tone.accent}>suggested</span> {suggestion.suggestedIndex}{' '}
              <span className={tone.muted}>from Slow Queries</span> ·{' '}
              {hasBuild ? (
                build.progress === null ? (
                  <span className={tone.success}>ready ✓</span>
                ) : (
                  <span className={tone.warning}>building {build.progress}%</span>
                )
              ) : (
                <span className={tone.muted}>not created yet</span>
              )}
            </p>
          ) : null}
        </div>
      </Screen>
    </DemoCard>
  )
}
