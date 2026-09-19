import { describe, expect, it } from 'vitest'
import { LogLineRingBuffer } from './ring-buffer'
import type { TailLogLine } from './types'

function line(msg: string): TailLogLine {
  return {
    timestamp: 0,
    severity: 3,
    severityLabel: 'I',
    component: 'COMMAND',
    id: 1,
    ctx: 'c',
    msg,
    namespace: null,
    durationMillis: null,
    planSummary: null,
    kind: 'json',
  }
}

describe('LogLineRingBuffer', () => {
  it('evicts oldest entries when over capacity', () => {
    const ring = new LogLineRingBuffer(3)
    ring.push(line('a'))
    ring.push(line('b'))
    ring.push(line('c'))
    ring.push(line('d'))
    ring.push(line('e'))

    expect(ring.size).toBe(3)
    expect(ring.toArray().map((entry) => entry.msg)).toEqual(['c', 'd', 'e'])
  })

  it('preserves order under capacity', () => {
    const ring = new LogLineRingBuffer(5)
    ring.pushMany([line('1'), line('2'), line('3')])
    expect(ring.toArray().map((entry) => entry.msg)).toEqual(['1', '2', '3'])
  })

  it('clear empties the buffer', () => {
    const ring = new LogLineRingBuffer(2)
    ring.push(line('x'))
    ring.clear()
    expect(ring.size).toBe(0)
    expect(ring.toArray()).toEqual([])
  })
})
