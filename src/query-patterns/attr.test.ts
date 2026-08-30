import { describe, expect, it } from 'vitest'
import { extractSlowQueryAttr } from './attr'

describe('extractSlowQueryAttr', () => {
  it('extracts find command fields', () => {
    const attr = {
      type: 'command',
      ns: 'govdb.applications',
      command: {
        find: 'applications',
        filter: { status: 'pending', district: 'dehradun' },
        $db: 'govdb',
      },
      planSummary: 'COLLSCAN',
      docsExamined: 96400,
      nreturned: 40,
      durationMillis: 842,
    }

    const got = extractSlowQueryAttr(attr)
    expect(got).not.toBeNull()
    expect(got!.namespace).toBe('govdb.applications')
    expect(got!.op).toBe('find')
    expect(got!.shape).toBe('{district:1, status:1}')
    expect(got!.durationMs).toBe(842)
    expect(got!.docsExamined).toBe(96400)
    expect(got!.docsReturned).toBe(40)
    expect(got!.plan).toBe('COLLSCAN')
    expect(got!.equalityFields).toEqual(['status', 'district'])
    expect(got!.filterDisplay).toContain('pending')
  })

  it('extracts aggregate pipeline shape', () => {
    const attr = {
      ns: 'govdb.applications',
      command: {
        aggregate: 'applications',
        pipeline: [{ $lookup: { from: 'projects', as: 'p' } }],
        cursor: {},
      },
      planSummary: 'IXSCAN { _id: 1 }',
      docsExamined: 100,
      nreturned: 100,
      durationMillis: 50,
    }
    const got = extractSlowQueryAttr(attr)
    expect(got!.op).toBe('aggregate')
    expect(got!.shape).toBe('$lookup -> projects')
    expect(got!.plan).toBe('IXSCAN')
  })

  it('uses n/a shape for insert', () => {
    const attr = {
      ns: 'govdb.candidates',
      command: { insert: 'candidates', documents: [{}], $db: 'govdb' },
      durationMillis: 8,
      nreturned: 0,
    }
    const got = extractSlowQueryAttr(attr)
    expect(got!.op).toBe('insert')
    expect(got!.shape).toBe('n/a')
    expect(got!.plan).toBe('n/a')
  })

  it('returns null without ns', () => {
    expect(extractSlowQueryAttr({ durationMillis: 1 })).toBeNull()
    expect(extractSlowQueryAttr(null)).toBeNull()
  })
})
