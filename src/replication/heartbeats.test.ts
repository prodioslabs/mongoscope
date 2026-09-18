import { describe, expect, it } from 'vitest'
import { normalizeHeartbeats } from './heartbeats'

describe('normalizeHeartbeats', () => {
  it('returns pingMs edges from the connected member only', () => {
    const view = normalizeHeartbeats({
      members: [
        { _id: 0, name: 'rs0-a:27017', self: true },
        { _id: 1, name: 'rs0-b:27017', pingMs: 4 },
        { _id: 2, name: 'rs0-c:27017', pingMs: 6 },
      ],
    })

    expect(view).toEqual({
      fromName: 'rs0-a:27017',
      edges: [
        { fromName: 'rs0-a:27017', toName: 'rs0-b:27017', pingMs: 4 },
        { fromName: 'rs0-a:27017', toName: 'rs0-c:27017', pingMs: 6 },
      ],
    })
  })

  it('skips self and members without pingMs', () => {
    const view = normalizeHeartbeats({
      members: [
        { _id: 0, name: 'a:27017', self: true, pingMs: 1 },
        { _id: 1, name: 'b:27017' },
      ],
    })
    expect(view?.edges).toEqual([])
  })

  it('returns null for empty input', () => {
    expect(normalizeHeartbeats(null)).toBeNull()
  })
})
