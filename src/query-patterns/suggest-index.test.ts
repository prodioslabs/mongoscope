import { describe, expect, it } from 'vitest'
import { suggestIndex } from './suggest-index'

describe('suggestIndex', () => {
  it('suggests ESR equality index for COLLSCAN', () => {
    const suggestion = suggestIndex({
      namespace: 'govdb.applications',
      plan: 'COLLSCAN',
      equalityFields: ['status', 'district'],
      docsExamined: 96400,
      nReturned: 40,
    })

    expect(suggestion).not.toBeNull()
    expect(suggestion!.command).toBe('db.applications.createIndex({ status: 1, district: 1 })')
    expect(suggestion!.estimatedExamined).toBe(40)
    expect(suggestion!.reason).toContain('ESR rule')
    expect(suggestion!.reason).toContain('-99.9%')
    expect(suggestion!.database).toBe('govdb')
    expect(suggestion!.collection).toBe('applications')
    expect(suggestion!.keyLabel).toBe('status:1,district:1')
    expect(suggestion!.equalityFields).toEqual(['status', 'district'])
  })

  it('returns null for IXSCAN', () => {
    expect(
      suggestIndex({
        namespace: 'govdb.applications',
        plan: 'IXSCAN',
        equalityFields: ['status'],
        docsExamined: 10,
        nReturned: 10,
      }),
    ).toBeNull()
  })

  it('returns null without equality fields', () => {
    expect(
      suggestIndex({
        namespace: 'govdb.applications',
        plan: 'COLLSCAN',
        equalityFields: [],
        docsExamined: 100,
        nReturned: 5,
      }),
    ).toBeNull()
  })
})
