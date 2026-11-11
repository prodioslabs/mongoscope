import { describe, expect, it } from 'vitest'
import {
  DROP_INDEXES_CMD_ID,
  INDEX_BUILD_COMPLETE_ID,
  INDEX_BUILD_START_ID,
  filterMarkersForNamespace,
  indexMarkerFromAttr,
  SLOW_QUERY_ID,
} from './index-markers'

describe('indexMarkerFromAttr', () => {
  it('parses index build start', () => {
    const marker = indexMarkerFromAttr(
      {
        row: 0,
        id: INDEX_BUILD_START_ID,
        timestampMs: 1000,
        msg: 'Index build: starting',
      },
      {
        namespace: 'shop.orders',
        properties: { name: 'status_1' },
      },
    )
    expect(marker).toEqual({
      timestampMs: 1000,
      kind: 'index-build-start',
      namespace: 'shop.orders',
      label: 'status_1',
    })
  })

  it('parses completed successfully with indexesBuilt', () => {
    const marker = indexMarkerFromAttr(
      {
        row: 1,
        id: INDEX_BUILD_COMPLETE_ID,
        timestampMs: 2000,
        msg: 'Index build: completed successfully',
      },
      {
        namespace: 'shop.orders',
        indexesBuilt: ['status_1'],
      },
    )
    expect(marker?.kind).toBe('index-build-complete')
    expect(marker?.label).toBe('status_1')
  })

  it('parses CMD dropIndexes', () => {
    const marker = indexMarkerFromAttr(
      {
        row: 2,
        id: DROP_INDEXES_CMD_ID,
        timestampMs: 3000,
        msg: 'CMD: dropIndexes',
      },
      {
        namespace: 'shop.orders',
        indexes: 'status_1',
      },
    )
    expect(marker).toEqual({
      timestampMs: 3000,
      kind: 'drop-indexes',
      namespace: 'shop.orders',
      label: 'status_1',
    })
  })

  it('parses slow createIndexes and ignores unrelated slow queries', () => {
    const create = indexMarkerFromAttr(
      {
        row: 3,
        id: SLOW_QUERY_ID,
        timestampMs: 4000,
        msg: 'Slow query',
      },
      {
        ns: 'shop.orders',
        command: {
          createIndexes: 'orders',
          indexes: [{ name: 'status_1', key: { status: 1 } }],
          $db: 'shop',
        },
      },
    )
    expect(create?.kind).toBe('create-indexes')
    expect(create?.label).toBe('status_1')

    const other = indexMarkerFromAttr(
      {
        row: 4,
        id: SLOW_QUERY_ID,
        timestampMs: 5000,
        msg: 'Slow query',
      },
      {
        ns: 'shop.orders',
        command: { find: 'orders', filter: { status: 1 }, $db: 'shop' },
      },
    )
    expect(other).toBeNull()
  })

  it('returns null when timestamp is missing', () => {
    expect(
      indexMarkerFromAttr(
        {
          row: 0,
          id: INDEX_BUILD_START_ID,
          timestampMs: Number.NaN,
          msg: 'Index build: starting',
        },
        { namespace: 'shop.orders' },
      ),
    ).toBeNull()
  })
})

describe('filterMarkersForNamespace', () => {
  it('keeps exact namespace matches only', () => {
    const markers = [
      {
        timestampMs: 1,
        kind: 'drop-indexes' as const,
        namespace: 'shop.orders',
        label: 'a',
      },
      {
        timestampMs: 2,
        kind: 'drop-indexes' as const,
        namespace: 'shop.users',
        label: 'b',
      },
    ]
    expect(filterMarkersForNamespace(markers, 'shop.orders')).toHaveLength(1)
    expect(filterMarkersForNamespace(markers, '')).toEqual([])
  })
})
