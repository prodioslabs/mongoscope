import { describe, expect, it } from 'vitest'
import { encodeSeverity, getEntry, LogStore } from './store'

describe('LogStore', () => {
  it('materializes entries and interns repeated strings', () => {
    const store = new LogStore('mem://test')
    store.pushJson({
      offset: 0,
      length: 10,
      timestamp: 1,
      severity: encodeSeverity('I'),
      id: 1,
      component: 'COMMAND',
      ctx: 'conn1',
      msg: 'Slow query',
    })
    store.pushJson({
      offset: 11,
      length: 10,
      timestamp: 2,
      severity: encodeSeverity('I'),
      id: 2,
      component: 'COMMAND',
      ctx: 'conn1',
      msg: 'Slow query',
    })

    const a = getEntry(store, 0)
    const b = getEntry(store, 1)
    expect(a.component).toBe('COMMAND')
    expect(b.ctx).toBe('conn1')
    expect(a.msg).toBe(b.msg)

    const mem = store.memoryEstimate()
    expect(mem.internCounts.component).toBe(1)
    expect(mem.internCounts.ctx).toBe(1)
    expect(mem.internCounts.msg).toBe(1)
    expect(mem.rowCount).toBe(2)
  })

  it('grows past initial capacity', () => {
    const store = new LogStore('mem://grow', 4)
    for (let i = 0; i < 100; i++) {
      store.pushJson({
        offset: i * 10,
        length: 9,
        timestamp: i,
        severity: encodeSeverity('W'),
        id: i,
        component: 'STORAGE',
        ctx: `conn${i % 3}`,
        msg: 'hello',
      })
    }
    expect(store.rowCount).toBe(100)
    expect(getEntry(store, 99).id).toBe(99)
    expect(store.memoryEstimate().internCounts.ctx).toBe(3)
  })

  it('stores raw rows distinctly', () => {
    const store = new LogStore('mem://raw')
    store.pushRaw({ offset: 0, length: 5, text: 'hello' })
    const entry = getEntry(store, 0)
    expect(entry.kind).toBe('raw')
    expect(Number.isNaN(entry.timestamp)).toBe(true)
    expect(entry.msg).toBe('hello')
    expect(entry.component).toBe('')
  })

  it('throws on out-of-range getEntry', () => {
    const store = new LogStore('mem://empty')
    expect(() => getEntry(store, 0)).toThrow(RangeError)
  })
})
