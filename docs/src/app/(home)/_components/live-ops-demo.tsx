'use client'

import { useEffect, useReducer, useState } from 'react'
import { cn } from '@/lib/utils'
import { docsRoute } from '@/lib/shared'
import { DemoCard, KeyChip } from './demo-card'
import { initialLiveOps, liveOpKinds, liveOpNamespaces, type LiveOp } from './demo-data'
import { Screen, ScreenFooter, secondsTone, TerminalButton, tone } from './terminal'

const pollMs = 1000
const noticeMs = 3500
const opsGrid = 'grid grid-cols-[3rem_minmax(0,1fr)_2.5rem_4.5rem] items-center gap-2 px-1.5'

type OpsAction =
  /** `rolls` are pre-drawn random numbers so the reducer stays pure under Strict Mode. */
  { type: 'tick'; rolls: number[] } | { type: 'kill'; id: number }

function opsReducer(ops: LiveOp[], action: OpsAction): LiveOp[] {
  if (action.type === 'kill') {
    return ops.map((op) => (op.id === action.id ? { ...op, killedFor: 0 } : op))
  }

  const next = ops
    .map((op) =>
      op.killedFor === undefined
        ? { ...op, seconds: op.seconds + 1 }
        : { ...op, killedFor: op.killedFor + 1 },
    )
    // Fast IXSCAN ops finish within seconds; the COLLSCAN keeps running until killed.
    .filter((op) =>
      op.killedFor === undefined
        ? op.seconds < (op.plan === 'COLLSCAN' ? 90 : 4 + (op.id % 6))
        : op.killedFor < 2,
    )

  let id = Math.max(48230, ...ops.map((op) => op.id))
  let roll = 0
  while (next.filter((op) => op.killedFor === undefined).length < 3) {
    const value = action.rolls[roll % action.rolls.length] ?? 0.5
    roll += 1
    id += 2 + Math.floor(value * 8)
    const scanning = next.some((op) => op.killedFor === undefined && op.plan === 'COLLSCAN')
    next.push({
      id,
      namespace: liveOpNamespaces[Math.floor(value * liveOpNamespaces.length)] ?? 'app.orders',
      op: liveOpKinds[Math.floor(((value * 7) % 1) * liveOpKinds.length)] ?? 'find',
      seconds: 0,
      plan: scanning ? 'IXSCAN' : 'COLLSCAN',
    })
  }
  return next
}

export function LiveOpsDemo() {
  const [ops, dispatch] = useReducer(opsReducer, initialLiveOps)
  const [selectedId, setSelectedId] = useState(initialLiveOps[0]?.id)
  const [confirming, setConfirming] = useState(false)
  const [notice, setNotice] = useState<{ id: number; text: string } | null>(null)

  const running = ops.filter((op) => op.killedFor === undefined)
  // Completed or killed selections fall back to the first running op.
  const selected = running.find((op) => op.id === selectedId) ?? running[0]

  useEffect(function pollCurrentOp() {
    const timer = window.setInterval(() => {
      dispatch({ type: 'tick', rolls: [Math.random(), Math.random(), Math.random()] })
    }, pollMs)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(
    function clearNoticeLater() {
      if (!notice) {
        return
      }
      const timer = window.setTimeout(() => setNotice(null), noticeMs)
      return () => window.clearTimeout(timer)
    },
    [notice],
  )

  function askToKill() {
    if (selected) {
      setConfirming(true)
    }
  }

  function answerKill(kill: boolean) {
    if (!confirming) {
      return
    }
    setConfirming(false)
    if (kill && selected) {
      dispatch({ type: 'kill', id: selected.id })
      setNotice({ id: selected.id, text: `killed op ${selected.id} (${selected.namespace})` })
    }
  }

  function moveSelection(delta: number) {
    const index = running.findIndex((op) => op.id === selected?.id)
    const next = running[Math.min(running.length - 1, Math.max(0, index + delta))]
    if (next) {
      setSelectedId(next.id)
    }
  }

  const scans = running.filter((op) => op.plan === 'COLLSCAN').length

  return (
    <DemoCard
      id="live-ops"
      tabKey="2"
      title="Live Ops"
      badge="Live"
      docsHref={`${docsRoute}/live-ops`}
      description="currentOp, polled every second. Long-running and COLLSCAN ops stand out, and you can kill one without leaving the keyboard."
      keys={{
        x: askToKill,
        y: () => answerKill(true),
        n: () => answerKill(false),
        j: () => moveSelection(1),
        k: () => moveSelection(-1),
      }}
      keyHints={['x', 'j', 'k']}
      controls={
        <KeyChip hotkey="x" danger onClick={askToKill}>
          kill selected op
        </KeyChip>
      }
    >
      <Screen>
        <div className="flex min-w-70 flex-1 flex-col">
          <div className={cn(opsGrid, tone.muted)}>
            <span>OPID</span>
            <span>NS</span>
            <span>SECS</span>
            <span>PLAN</span>
          </div>
          <div className="mb-2">
            {ops.map((op) => {
              const killed = op.killedFor !== undefined
              return (
                <button
                  key={op.id}
                  type="button"
                  disabled={killed}
                  aria-pressed={op.id === selected?.id}
                  onClick={() => {
                    setSelectedId(op.id)
                    setConfirming(false)
                  }}
                  className={cn(
                    opsGrid,
                    'h-7 w-full rounded-md text-left transition-[opacity,background-color] duration-700',
                    op.id === selected?.id ? 'bg-(--tui-panel)' : 'hover:bg-(--tui-panel)/55',
                    killed && 'line-through opacity-30',
                  )}
                >
                  <span>{op.id}</span>
                  <span className={cn('truncate', tone.info)}>{op.namespace}</span>
                  <span className={secondsTone(op.seconds)}>{op.seconds}s</span>
                  <span className={op.plan === 'COLLSCAN' ? tone.error : tone.success}>
                    {op.plan}
                  </span>
                </button>
              )
            })}
          </div>

          {confirming && selected ? (
            <div className="mb-2 flex flex-wrap items-center gap-2 rounded-md border border-(--tui-error)/40 bg-(--tui-error)/14 px-2 py-1.5">
              <span className={tone.warning}>Kill op {selected.id}?</span>
              <TerminalButton onClick={() => answerKill(true)}>
                <span className={tone.error}>y</span> kill
              </TerminalButton>
              <TerminalButton onClick={() => answerKill(false)}>
                <span className={tone.accent}>n</span> cancel
              </TerminalButton>
            </div>
          ) : null}

          <ScreenFooter>
            {notice?.text ?? `polling every 1s · ${running.length} active · ${scans} COLLSCAN`}
          </ScreenFooter>
        </div>
      </Screen>
    </DemoCard>
  )
}
