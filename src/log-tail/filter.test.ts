import { describe, expect, it } from 'vitest'
import {
  evaluateCustomFilter,
  filterTailLines,
  lineMatchesSearch,
  parseCustomFilterExpression,
} from './filter'
import type { TailLogLine } from './types'

function line(overrides: Partial<TailLogLine> = {}): TailLogLine {
  return {
    timestamp: 0,
    severity: 3,
    severityLabel: 'I',
    component: 'COMMAND',
    id: 1,
    ctx: 'c',
    msg: 'Slow query',
    namespace: 'app.users',
    durationMillis: 150,
    planSummary: 'COLLSCAN',
    kind: 'json',
    ...overrides,
  }
}

describe('parseCustomFilterExpression', () => {
  it('parses durationMillis comparisons', () => {
    const result = parseCustomFilterExpression('durationMillis>100')
    expect(result).toEqual({
      ok: true,
      expression: {
        field: 'durationMillis',
        operator: '>',
        value: '100',
        numericValue: 100,
      },
    })
  })

  it('parses contains with spaces around operator', () => {
    const result = parseCustomFilterExpression('namespace contains app.users')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.expression.field).toBe('namespace')
      expect(result.expression.operator).toBe('contains')
      expect(result.expression.value).toBe('app.users')
    }
  })

  it('rejects empty input', () => {
    expect(parseCustomFilterExpression('   ')).toEqual({
      ok: false,
      error: 'empty filter expression',
    })
  })

  it('rejects unknown field', () => {
    const result = parseCustomFilterExpression('docsExamined>10')
    expect(result.ok).toBe(false)
  })

  it('rejects numeric ops on string fields', () => {
    const result = parseCustomFilterExpression('namespace>10')
    expect(result).toEqual({
      ok: false,
      error: 'operator > is only valid for durationMillis',
    })
  })

  it('rejects non-numeric durationMillis value', () => {
    const result = parseCustomFilterExpression('durationMillis=fast')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('must be a number')
    }
  })

  it('rejects contains on durationMillis', () => {
    const result = parseCustomFilterExpression('durationMillis contains 10')
    expect(result.ok).toBe(false)
  })
})

describe('evaluateCustomFilter', () => {
  it('matches durationMillis >', () => {
    const parsed = parseCustomFilterExpression('durationMillis>100')
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }
    expect(evaluateCustomFilter(line({ durationMillis: 150 }), parsed.expression)).toBe(true)
    expect(evaluateCustomFilter(line({ durationMillis: 50 }), parsed.expression)).toBe(false)
    expect(evaluateCustomFilter(line({ durationMillis: null }), parsed.expression)).toBe(false)
  })

  it('matches namespace contains case-insensitively', () => {
    const parsed = parseCustomFilterExpression('namespace contains USERS')
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }
    expect(evaluateCustomFilter(line({ namespace: 'app.users' }), parsed.expression)).toBe(true)
  })
})

describe('lineMatchesSearch', () => {
  it('matches msg or namespace only', () => {
    expect(lineMatchesSearch(line({ msg: 'hello applications' }), 'APPLICATIONS')).toBe(true)
    expect(lineMatchesSearch(line({ namespace: 'app.applications' }), 'applications')).toBe(true)
    expect(
      lineMatchesSearch(
        line({ msg: 'ok', namespace: null, planSummary: 'applications' }),
        'applications',
      ),
    ).toBe(false)
  })
})

describe('filterTailLines', () => {
  it('applies category, custom filter, and search together', () => {
    const parsed = parseCustomFilterExpression('durationMillis>=100')
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }
    const lines = [
      line({ component: 'COMMAND', durationMillis: 200, msg: 'Slow query applications' }),
      line({ component: 'NETWORK', durationMillis: 200, msg: 'Slow query applications' }),
      line({ component: 'COMMAND', durationMillis: 50, msg: 'Slow query applications' }),
      line({ component: 'COMMAND', durationMillis: 200, msg: 'other' }),
    ]
    const filtered = filterTailLines(lines, {
      enabledCategories: new Set(['COMMAND']),
      customFilter: parsed.expression,
      search: 'applications',
    })
    expect(filtered).toHaveLength(1)
    expect(filtered[0]!.durationMillis).toBe(200)
  })
})
