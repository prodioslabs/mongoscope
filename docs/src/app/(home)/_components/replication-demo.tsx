'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { docsRoute } from '@/lib/shared'
import { DemoCard } from './demo-card'
import { initialLagHistory, lagHistoryLength, nextLag, replicaMembers } from './demo-data'
import { lagTone, Screen, ScreenFooter, tone } from './terminal'

const sampleMs = 1000
const sparkWidth = 240
const sparkHeight = 46

export function ReplicationDemo() {
  const [history, setHistory] = useState(initialLagHistory)
  const [selectedIndex, setSelectedIndex] = useState(2)

  useEffect(function sampleLag() {
    const timer = window.setInterval(() => {
      const rolls = replicaMembers.map(() => Math.random())
      setHistory((previous) =>
        previous.map((samples, index) => {
          const range = replicaMembers[index]?.lagRange
          const last = samples[samples.length - 1]
          if (!range || last === undefined) {
            return samples
          }
          return [...samples, nextLag(last, range, rolls[index] ?? 0.5)].slice(-lagHistoryLength)
        }),
      )
    }, sampleMs)
    return () => window.clearInterval(timer)
  }, [])

  function moveSelection(delta: number) {
    setSelectedIndex((index) => Math.min(replicaMembers.length - 1, Math.max(0, index + delta)))
  }

  const selectedMember = replicaMembers[selectedIndex]
  const selectedHistory = history[selectedIndex] ?? []
  const selectedLag = selectedHistory[selectedHistory.length - 1]

  return (
    <DemoCard
      id="replication"
      tabKey="3"
      title="Replication"
      badge="Live"
      docsHref={`${docsRoute}/replication`}
      description="Topology, oplog window and a lag trend for every member. Click a member to see its trend."
      keys={{ j: () => moveSelection(1), k: () => moveSelection(-1) }}
      keyHints={['j', 'k']}
    >
      <Screen>
        <div className="flex min-w-65 flex-1 flex-col">
          {replicaMembers.map((member, index) => {
            const samples = history[index] ?? []
            const lag = samples[samples.length - 1]
            return (
              <button
                key={member.host}
                type="button"
                aria-pressed={index === selectedIndex}
                onClick={() => setSelectedIndex(index)}
                className={cn(
                  'grid h-7 w-full grid-cols-[minmax(0,1fr)_4.75rem_2.875rem] items-center gap-2 rounded-md px-1.5 text-left whitespace-nowrap transition-colors',
                  index === selectedIndex ? 'bg-(--tui-panel)' : 'hover:bg-(--tui-panel)/55',
                )}
              >
                <span className="truncate">
                  {index > 0 ? (
                    <span className={tone.muted}>
                      {index === replicaMembers.length - 1 ? '└─ ' : '├─ '}
                    </span>
                  ) : null}
                  <span className={lag === undefined ? tone.success : lagTone(lag)}>●</span>{' '}
                  {member.host}
                </span>
                <span className={member.state === 'PRIMARY' ? tone.accent : tone.primary}>
                  {member.state}
                </span>
                <span className={cn('text-right', lag === undefined ? tone.muted : lagTone(lag))}>
                  {lag === undefined ? '—' : `${lag.toFixed(1)}s`}
                </span>
              </button>
            )
          })}

          <div className="my-2">
            <div className={cn('flex justify-between gap-2 whitespace-nowrap', tone.muted)}>
              <span>
                {selectedMember?.lagRange
                  ? `lag · ${selectedMember.host.split(':')[0]} · ~10m`
                  : 'primary: no replication lag'}
              </span>
              {selectedHistory.length > 0 ? (
                <span>peak {Math.max(...selectedHistory).toFixed(1)}s</span>
              ) : null}
            </div>
            <Sparkline
              samples={selectedHistory}
              className={selectedLag === undefined ? 'invisible' : lagTone(selectedLag)}
            />
          </div>

          <ScreenFooter>
            <span className={tone.muted}>oplog</span> <span className={tone.fg}>41h 12m</span>{' '}
            <span className="inline-block h-1.75 w-17.5 overflow-hidden rounded-full bg-(--tui-muted)/30 align-middle">
              <span className="block h-full w-[62%] rounded-full bg-(--tui-success)" />
            </span>{' '}
            62% full
          </ScreenFooter>
        </div>
      </Screen>
    </DemoCard>
  )
}

type SparklineProps = {
  samples: number[]
  className?: string
}

function Sparkline({ samples, className }: SparklineProps) {
  // Per-member scale so a healthy secondary still shows movement.
  const yMax = Math.max(2, ...samples.map((sample) => sample * 1.25))
  const points = samples.map((sample, index) => [
    (index / Math.max(1, samples.length - 1)) * sparkWidth,
    sparkHeight - 2 - (sample / yMax) * (sparkHeight - 6),
  ])
  const line = points
    .map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x?.toFixed(1)} ${y?.toFixed(1)}`)
    .join('')

  return (
    <svg
      viewBox={`0 0 ${sparkWidth} ${sparkHeight}`}
      preserveAspectRatio="none"
      aria-hidden
      className={cn('block h-11.5 w-full', className)}
    >
      {line ? (
        <>
          <path
            d={`${line}L${sparkWidth} ${sparkHeight}L0 ${sparkHeight}Z`}
            className="fill-current opacity-15"
          />
          <path
            d={line}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            vectorEffect="non-scaling-stroke"
          />
        </>
      ) : null}
    </svg>
  )
}
