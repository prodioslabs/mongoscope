import { describe, expect, it } from 'vitest'
import {
  appendLagSample,
  buildLagTrendView,
  emptyLagHistory,
  pickLagTrendMember,
  poolLagSamples,
  pruneLagHistory,
} from './lag-history'
import type { TopologyMember } from './types'

function member(
  partial: Partial<TopologyMember> & Pick<TopologyMember, 'id' | 'name'>,
): TopologyMember {
  return {
    id: partial.id,
    name: partial.name,
    host: partial.host ?? partial.name,
    stateStr: partial.stateStr ?? 'SECONDARY',
    health: partial.health ?? 1,
    priority: partial.priority ?? 1,
    votes: partial.votes ?? 1,
    lagSeconds: partial.lagSeconds ?? 0,
    severity: partial.severity ?? 'success',
    self: partial.self ?? false,
  }
}

describe('pickLagTrendMember', () => {
  it('picks the secondary with the highest lag', () => {
    const picked = pickLagTrendMember([
      member({ id: 0, name: 'a:27017', stateStr: 'PRIMARY', lagSeconds: 0 }),
      member({ id: 1, name: 'b:27017', lagSeconds: 1.2 }),
      member({ id: 2, name: 'c:27017', lagSeconds: 8.4 }),
    ])
    expect(picked?.id).toBe(2)
  })

  it('skips arbiters and members without lag', () => {
    expect(
      pickLagTrendMember([
        member({ id: 0, name: 'a:27017', stateStr: 'PRIMARY', lagSeconds: 0 }),
        member({ id: 1, name: 'arb:27017', stateStr: 'ARBITER', lagSeconds: null }),
      ]),
    ).toBeNull()
  })
})

describe('appendLagSample / pruneLagHistory', () => {
  it('resets when the focused member changes', () => {
    const first = appendLagSample(
      emptyLagHistory(),
      member({ id: 1, name: 'b:27017', lagSeconds: 2 }),
      1_000,
    )
    const switched = appendLagSample(
      first,
      member({ id: 2, name: 'c:27017', lagSeconds: 5 }),
      2_000,
    )
    expect(switched.memberId).toBe(2)
    expect(switched.samples).toHaveLength(1)
    expect(switched.samples[0]?.lagSeconds).toBe(5)
  })

  it('drops samples outside the window', () => {
    let state = emptyLagHistory()
    state = appendLagSample(state, member({ id: 1, name: 'b:27017', lagSeconds: 1 }), 0)
    state = appendLagSample(state, member({ id: 1, name: 'b:27017', lagSeconds: 2 }), 60_000)
    state = pruneLagHistory(state, 60_000 + 10 * 60 * 1000, 10 * 60 * 1000)
    expect(state.samples).toHaveLength(1)
    expect(state.samples[0]?.lagSeconds).toBe(2)
  })
})

describe('poolLagSamples / buildLagTrendView', () => {
  it('max-pools into a fixed bar count', () => {
    expect(poolLagSamples([1, 8, 2, 9], 2)).toEqual([8, 9])
  })

  it('reports peak/current and collecting until two samples', () => {
    let state = appendLagSample(
      emptyLagHistory(),
      member({ id: 2, name: 'c:27017', lagSeconds: 6 }),
      1_000,
    )
    expect(buildLagTrendView(state, 4)?.collecting).toBe(true)
    state = appendLagSample(state, member({ id: 2, name: 'c:27017', lagSeconds: 8.4 }), 2_000)
    const view = buildLagTrendView(state, 4)
    expect(view).toMatchObject({
      memberId: 2,
      peakLagSeconds: 8.4,
      currentLagSeconds: 8.4,
      collecting: false,
    })
    expect(view?.bars).toHaveLength(4)
  })
})
