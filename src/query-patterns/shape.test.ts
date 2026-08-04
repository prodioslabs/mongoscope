import { describe, expect, it } from 'vitest'
import { equalityFieldsOfFilter, shapeOfFilter, shapeOfPipeline } from './shape'

describe('shapeOfFilter', () => {
  it('replaces primitives with 1 and sorts keys', () => {
    expect(shapeOfFilter({ district: 'dehradun', status: 'pending' })).toBe(
      '{district:1, status:1}',
    )
  })

  it('preserves operators', () => {
    expect(shapeOfFilter({ age: { $gt: 18 }, status: 'ok' })).toBe('{age:{$gt:1}, status:1}')
  })

  it('collapses $in arrays of primitives', () => {
    expect(shapeOfFilter({ status: { $in: ['a', 'b', 'c'] } })).toBe('{status:{$in:[1]}}')
  })

  it('collapses extended JSON wrappers', () => {
    expect(shapeOfFilter({ _id: { $oid: '507f1f77bcf86cd799439011' } })).toBe('{_id:1}')
  })

  it('returns empty object for empty filter', () => {
    expect(shapeOfFilter({})).toBe('{}')
  })
})

describe('shapeOfPipeline', () => {
  it('labels stages and annotates $lookup from', () => {
    const pipeline = [
      { $match: { status: 1 } },
      { $lookup: { from: 'projects', localField: 'a', foreignField: 'b', as: 'p' } },
    ]
    expect(shapeOfPipeline(pipeline)).toBe('$match → $lookup -> projects')
  })

  it('returns n/a for empty pipeline', () => {
    expect(shapeOfPipeline([])).toBe('n/a')
    expect(shapeOfPipeline(null)).toBe('n/a')
  })
})

describe('equalityFieldsOfFilter', () => {
  it('returns equality keys only', () => {
    expect(equalityFieldsOfFilter({ status: 'pending', age: { $gt: 18 }, district: 'x' })).toEqual([
      'status',
      'district',
    ])
  })

  it('skips top-level operators', () => {
    expect(equalityFieldsOfFilter({ $or: [{ a: 1 }, { b: 1 }] })).toEqual([])
  })
})
