import { describe, expect, it } from 'vitest'
import { normalizeRecentReplicationEvents } from './recent-events'

function line(partial: {
  c: string
  msg: string
  t?: string
}): string {
  return JSON.stringify({
    t: { $date: partial.t ?? '2026-07-29T03:14:00.000Z' },
    s: 'I',
    c: partial.c,
    msg: partial.msg,
  })
}

describe('normalizeRecentReplicationEvents', () => {
  it('keeps REPL/ELECTION lines newest-first and skips other components', () => {
    const events = normalizeRecentReplicationEvents({
      log: [
        line({ c: 'CONTROL', msg: 'build info' }),
        line({ c: 'REPL', msg: 'rs0-a stepped down', t: '2026-07-29T03:13:00.000Z' }),
        line({ c: 'ELECTION', msg: 'rs0-a elected PRIMARY', t: '2026-07-29T03:14:00.000Z' }),
        line({ c: 'NETWORK', msg: 'connection accepted' }),
      ],
    })

    expect(events).toHaveLength(2)
    expect(events[0]?.message).toBe('rs0-a elected PRIMARY')
    expect(events[0]?.component).toBe('ELECTION')
    expect(events[1]?.message).toBe('rs0-a stepped down')
  })

  it('respects the display limit', () => {
    const log = Array.from({ length: 20 }, (_, i) =>
      line({ c: 'REPL', msg: `event ${i}`, t: `2026-07-29T03:${String(i).padStart(2, '0')}:00.000Z` }),
    )
    expect(normalizeRecentReplicationEvents({ log }, 5)).toHaveLength(5)
  })

  it('returns empty for missing log payload', () => {
    expect(normalizeRecentReplicationEvents(null)).toEqual([])
    expect(normalizeRecentReplicationEvents({ log: ['not-json'] })).toEqual([])
  })
})
