import { describe, expect, it } from 'vitest'
import { indexBuildKey, parseIndexBuildOps } from './parse-index-builds'

describe('indexBuildKey', () => {
  it('joins database, collection, and index name', () => {
    expect(indexBuildKey('shop', 'orders', 'status_1')).toBe('shop.orders::status_1')
  })
})

describe('parseIndexBuildOps', () => {
  it('reads percent from progress.done/total on createIndexes', () => {
    const map = parseIndexBuildOps([
      {
        op: 'command',
        ns: 'shop.orders',
        msg: 'Index Build: scanning collection: 4200/10000 42%',
        progress: { done: 4200, total: 10_000 },
        command: {
          createIndexes: 'orders',
          indexes: [{ name: 'status_1', key: { status: 1 } }],
          $db: 'shop',
        },
      },
    ])

    expect(map.get('shop.orders::status_1')).toEqual({
      database: 'shop',
      collection: 'orders',
      indexName: 'status_1',
      percent: 42,
      message: 'Index Build: scanning collection: 4200/10000 42%',
    })
  })

  it('falls back to percent parsed from msg when progress is missing', () => {
    const map = parseIndexBuildOps([
      {
        op: 'command',
        ns: 'shop.orders',
        msg: 'Index Build (status_1): 18%',
        command: {
          createIndexes: 'orders',
          indexes: [{ name: 'status_1', key: { status: 1 } }],
        },
      },
    ])

    expect(map.get('shop.orders::status_1')?.percent).toBe(18)
  })

  it('expands multi-index createIndexes commands', () => {
    const map = parseIndexBuildOps([
      {
        op: 'command',
        ns: 'shop.orders',
        progress: { done: 1, total: 2 },
        command: {
          createIndexes: 'orders',
          indexes: [
            { name: 'a_1', key: { a: 1 } },
            { name: 'b_1', key: { b: 1 } },
          ],
        },
      },
    ])

    expect(map.get('shop.orders::a_1')?.percent).toBe(50)
    expect(map.get('shop.orders::b_1')?.percent).toBe(50)
  })

  it('parses idle Index Build worker ops from msg + ns', () => {
    const map = parseIndexBuildOps([
      {
        op: 'none',
        active: false,
        ns: 'shop.orders',
        msg: 'Index Build: status_1 waiting for commit quorum',
      },
    ])

    expect(map.get('shop.orders::status_1')).toMatchObject({
      database: 'shop',
      collection: 'orders',
      indexName: 'status_1',
      percent: null,
      message: 'Index Build: status_1 waiting for commit quorum',
    })
  })

  it('ignores unrelated currentOp docs', () => {
    const map = parseIndexBuildOps([
      { op: 'query', ns: 'shop.orders', msg: 'find' },
      { op: 'command', command: { find: 'orders' } },
    ])
    expect(map.size).toBe(0)
  })

  it('marks building without percent when neither progress nor % is present', () => {
    const map = parseIndexBuildOps([
      {
        op: 'command',
        ns: 'shop.orders',
        msg: 'Index Build',
        command: {
          createIndexes: 'orders',
          indexes: [{ name: 'status_1', key: { status: 1 } }],
        },
      },
    ])

    expect(map.get('shop.orders::status_1')).toMatchObject({
      percent: null,
      indexName: 'status_1',
    })
  })
})
