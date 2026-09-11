import { describe, expect, it } from 'vitest'
import {
  extractIndexFlags,
  filterPickerDatabases,
  normalizeIndexSpecs,
  parseCollStatsIndexSizes,
  parseIndexStatsDocs,
  parseListCollectionsResult,
  parseListDatabasesResult,
} from './normalize'

describe('filterPickerDatabases', () => {
  it('drops admin/local/config', () => {
    expect(filterPickerDatabases(['admin', 'shop', 'local', 'config', 'analytics'])).toEqual([
      'shop',
      'analytics',
    ])
  })
})

describe('parseListDatabasesResult', () => {
  it('reads database names from listDatabases payload', () => {
    expect(
      parseListDatabasesResult({
        databases: [{ name: 'shop' }, { name: 'admin' }, { name: 1 }, {}],
      }),
    ).toEqual(['shop', 'admin'])
  })
})

describe('parseListCollectionsResult', () => {
  it('reads names from cursor firstBatch and skips system collections', () => {
    expect(
      parseListCollectionsResult({
        cursor: {
          firstBatch: [{ name: 'orders' }, { name: 'system.profile' }, { name: 'users' }],
        },
      }),
    ).toEqual(['orders', 'users'])
  })

  it('accepts a bare array of collection infos', () => {
    expect(parseListCollectionsResult([{ name: 'orders' }])).toEqual(['orders'])
  })
})

describe('extractIndexFlags', () => {
  it('detects common options and key types', () => {
    expect(
      extractIndexFlags({
        unique: true,
        sparse: true,
        partialFilterExpression: { a: { $exists: true } },
        expireAfterSeconds: 3600,
        hidden: true,
        key: { loc: '2dsphere', tag: 'text', shard: 'hashed', xy: '2d' },
      }),
    ).toEqual(['unique', 'sparse', 'partial', 'ttl', 'hidden', 'text', '2dsphere', '2d', 'hashed'])
  })
})

describe('parseIndexStatsDocs', () => {
  it('maps usage by index name', () => {
    const since = new Date('2024-01-01T00:00:00.000Z')
    const map = parseIndexStatsDocs([
      { name: '_id_', accesses: { ops: 10, since } },
      { name: 'a_1', accesses: { ops: 0, since } },
      { name: '' },
    ])
    expect(map.get('_id_')).toEqual({ ops: 10, since, building: false })
    expect(map.get('a_1')).toEqual({ ops: 0, since, building: false })
  })

  it('records building from $indexStats', () => {
    const map = parseIndexStatsDocs([{ name: 'a_1', building: true, accesses: { ops: 0 } }])
    expect(map.get('a_1')?.building).toBe(true)
  })
})

describe('parseCollStatsIndexSizes', () => {
  it('reads indexSizes and totalIndexSize', () => {
    expect(
      parseCollStatsIndexSizes({
        indexSizes: { _id_: 1024, a_1: 2048 },
        totalIndexSize: 3072,
      }),
    ).toEqual({
      indexSizes: { _id_: 1024, a_1: 2048 },
      totalIndexSizeBytes: 3072,
    })
  })
})

describe('normalizeIndexSpecs', () => {
  it('joins inventory, sizes, and usage', () => {
    const usage = parseIndexStatsDocs([
      {
        name: 'a_1',
        accesses: { ops: 42, since: new Date('2024-02-01T00:00:00.000Z') },
      },
    ])
    const rows = normalizeIndexSpecs(
      [
        { name: '_id_', key: { _id: 1 } },
        { name: 'a_1', key: { a: 1 }, unique: true },
      ],
      { _id_: 100, a_1: 200 },
      usage,
    )
    expect(rows).toEqual([
      {
        name: '_id_',
        keyLabel: '_id:1',
        flags: [],
        sizeBytes: 100,
        ops: null,
        since: null,
        building: false,
        buildPercent: null,
        buildMessage: null,
      },
      {
        name: 'a_1',
        keyLabel: 'a:1',
        flags: ['unique'],
        sizeBytes: 200,
        ops: 42,
        since: new Date('2024-02-01T00:00:00.000Z'),
        building: false,
        buildPercent: null,
        buildMessage: null,
      },
    ])
  })

  it('merges $currentOp build progress onto matching rows', () => {
    const builds = new Map([
      [
        'shop.orders::a_1',
        {
          database: 'shop',
          collection: 'orders',
          indexName: 'a_1',
          percent: 42,
          message: 'Index Build: 42%',
        },
      ],
    ])
    const rows = normalizeIndexSpecs(
      [{ name: 'a_1', key: { a: 1 } }],
      { a_1: 200 },
      null,
      { database: 'shop', collection: 'orders', buildsByKey: builds },
    )
    expect(rows[0]).toMatchObject({
      building: true,
      buildPercent: 42,
      buildMessage: 'Index Build: 42%',
    })
  })

  it('marks building from $indexStats when currentOp has no match', () => {
    const usage = parseIndexStatsDocs([{ name: 'a_1', building: true }])
    const rows = normalizeIndexSpecs([{ name: 'a_1', key: { a: 1 } }], {}, usage, {
      database: 'shop',
      collection: 'orders',
      buildsByKey: new Map(),
    })
    expect(rows[0]).toMatchObject({
      building: true,
      buildPercent: null,
    })
  })

  it('keeps sizes when usage map is null', () => {
    const rows = normalizeIndexSpecs([{ name: '_id_', key: { _id: 1 } }], { _id_: 50 }, null)
    expect(rows[0]?.ops).toBeNull()
    expect(rows[0]?.sizeBytes).toBe(50)
    expect(rows[0]?.building).toBe(false)
  })
})
