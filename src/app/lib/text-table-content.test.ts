import { describe, expect, it } from 'vitest'
import { computeTableCapacity, emptyTableRow, headerCell, padTableRows } from './text-table-content'

describe('computeTableCapacity', () => {
  it('derives visible row count from terminal height and chrome budget', () => {
    expect(computeTableCapacity(5, 25)).toBe(10)
    expect(computeTableCapacity(5, 6)).toBe(1)
  })
})

describe('padTableRows', () => {
  it('pads data rows to rowCapacity without altering the header', () => {
    const theme = {
      textMuted: { r: 0, g: 0, b: 0, a: 255 },
    } as Parameters<typeof headerCell>[1]
    const header = [headerCell('NAMESPACE', theme), headerCell('OP', theme)]
    const row = [headerCell('app.users', theme), headerCell('find', theme)]
    const padded = padTableRows([header, row], 3)
    expect(padded).toHaveLength(4)
    expect(padded[0]).toEqual(header)
    expect(padded[1]).toEqual(row)
    expect(padded[2]).toEqual(emptyTableRow(2))
    expect(padded[3]).toEqual(emptyTableRow(2))
  })

  it('does not pad when capacity is already met', () => {
    const theme = {
      textMuted: { r: 0, g: 0, b: 0, a: 255 },
    } as Parameters<typeof headerCell>[1]
    const header = [headerCell('NAMESPACE', theme)]
    const rows = [header, [headerCell('a', theme)], [headerCell('b', theme)]]
    expect(padTableRows(rows, 2)).toEqual(rows)
  })
})
