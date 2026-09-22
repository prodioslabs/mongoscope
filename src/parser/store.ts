export type SeverityCode = number

export const SEVERITY_UNKNOWN = 255
export const SEVERITY_RAW = 254

export const KIND_JSON = 0
export const KIND_RAW = 1

export type LogKind = 'json' | 'raw'

export type LogEntry = {
  row: number
  kind: LogKind
  timestamp: number
  severity: SeverityCode
  component: string
  id: number
  ctx: string
  msg: string
  offset: number
  length: number
}

export type LogEntryDetail = LogEntry & {
  attr?: unknown
  /** Raw line text, or the parsed JSON object for structured lines. */
  raw: string | Record<string, unknown>
}

/** Approximate in-memory footprint of a {@link LogStore} after indexing. */
export type MemoryEstimate = {
  /** Growable columnar typed arrays (includes unused capacity). */
  typedArraysBytes: number
  /** Interned component/ctx/msg strings plus Map overhead. */
  internBytes: number
  /** typedArraysBytes + internBytes (excludes JS object headers and the file on disk). */
  totalBytes: number
  rowCount: number
  internCounts: {
    component: number
    ctx: number
    msg: number
  }
}

const INITIAL_CAPACITY = 65_536

/**
 * Dense string table: LogStore stores Uint32 ids for component/ctx/msg so
 * repeated values share one heap string.
 */
class StringInterner {
  private readonly map = new Map<string, number>()
  readonly values: string[] = []

  intern(value: string): number {
    const existing = this.map.get(value)
    if (existing !== undefined) return existing
    const id = this.values.length
    this.map.set(value, id)
    this.values.push(value)
    return id
  }

  get(id: number): string {
    return this.values[id] ?? ''
  }

  get size(): number {
    return this.values.length
  }

  /** Approximate UTF-16 code units for strings + Map overhead. */
  estimateBytes(): number {
    let bytes = 0
    for (const value of this.values) {
      bytes += value.length * 2
    }
    // Rough Map overhead: ~32 bytes per entry + key pointer shared with values.
    bytes += this.values.length * 32
    return bytes
  }
}

function severityLabel(code: SeverityCode): string {
  switch (code) {
    case 0:
      return 'F'
    case 1:
      return 'E'
    case 2:
      return 'W'
    case 3:
      return 'I'
    case 4:
      return 'D'
    case 5:
      return 'D1'
    case 6:
      return 'D2'
    case 7:
      return 'D3'
    case 8:
      return 'D4'
    case 9:
      return 'D5'
    case SEVERITY_RAW:
      return ''
    default:
      return '?'
  }
}

export function encodeSeverity(s: string): SeverityCode {
  switch (s) {
    case 'F':
      return 0
    case 'E':
      return 1
    case 'W':
      return 2
    case 'I':
      return 3
    case 'D':
      return 4
    case 'D1':
      return 5
    case 'D2':
      return 6
    case 'D3':
      return 7
    case 'D4':
      return 8
    case 'D5':
      return 9
    default:
      return SEVERITY_UNKNOWN
  }
}

export { severityLabel }

export class LogStore {
  readonly path: string

  private capacity: number
  private length = 0

  offsets: Float64Array
  lengths: Uint32Array
  timestamps: Float64Array
  severities: Uint8Array
  ids: Uint32Array
  kinds: Uint8Array
  componentIds: Uint32Array
  ctxIds: Uint32Array
  msgIds: Uint32Array

  private readonly components = new StringInterner()
  private readonly ctxs = new StringInterner()
  private readonly msgs = new StringInterner()

  byteLength = 0

  constructor(path: string, initialCapacity = INITIAL_CAPACITY) {
    this.path = path
    this.capacity = initialCapacity
    this.offsets = new Float64Array(initialCapacity)
    this.lengths = new Uint32Array(initialCapacity)
    this.timestamps = new Float64Array(initialCapacity)
    this.severities = new Uint8Array(initialCapacity)
    this.ids = new Uint32Array(initialCapacity)
    this.kinds = new Uint8Array(initialCapacity)
    this.componentIds = new Uint32Array(initialCapacity)
    this.ctxIds = new Uint32Array(initialCapacity)
    this.msgIds = new Uint32Array(initialCapacity)
  }

  get rowCount(): number {
    return this.length
  }

  private ensureCapacity(needed: number): void {
    if (needed <= this.capacity) return
    let next = this.capacity
    while (next < needed) next *= 2

    const grow = <T extends Float64Array | Uint32Array | Uint8Array>(
      arr: T,
      Ctor: new (n: number) => T,
    ): T => {
      const out = new Ctor(next)
      out.set(arr)
      return out
    }

    this.offsets = grow(this.offsets, Float64Array)
    this.lengths = grow(this.lengths, Uint32Array)
    this.timestamps = grow(this.timestamps, Float64Array)
    this.severities = grow(this.severities, Uint8Array)
    this.ids = grow(this.ids, Uint32Array)
    this.kinds = grow(this.kinds, Uint8Array)
    this.componentIds = grow(this.componentIds, Uint32Array)
    this.ctxIds = grow(this.ctxIds, Uint32Array)
    this.msgIds = grow(this.msgIds, Uint32Array)
    this.capacity = next
  }

  pushJson(row: {
    offset: number
    length: number
    timestamp: number
    severity: SeverityCode
    id: number
    component: string
    ctx: string
    msg: string
  }): number {
    this.ensureCapacity(this.length + 1)
    const i = this.length
    this.offsets[i] = row.offset
    this.lengths[i] = row.length
    this.timestamps[i] = row.timestamp
    this.severities[i] = row.severity
    this.ids[i] = row.id >>> 0
    this.kinds[i] = KIND_JSON
    this.componentIds[i] = this.components.intern(row.component)
    this.ctxIds[i] = this.ctxs.intern(row.ctx)
    this.msgIds[i] = this.msgs.intern(row.msg)
    this.length = i + 1
    return i
  }

  pushRaw(row: { offset: number; length: number; text: string }): number {
    this.ensureCapacity(this.length + 1)
    const i = this.length
    this.offsets[i] = row.offset
    this.lengths[i] = row.length
    this.timestamps[i] = Number.NaN
    this.severities[i] = SEVERITY_RAW
    this.ids[i] = 0
    this.kinds[i] = KIND_RAW
    this.componentIds[i] = this.components.intern('')
    this.ctxIds[i] = this.ctxs.intern('')
    this.msgIds[i] = this.msgs.intern(row.text)
    this.length = i + 1
    return i
  }

  /**
   * Keep only the last `maxRows` entries (drop oldest). No-op when already ≤ maxRows.
   * Intern tables are left as-is (may retain unused strings).
   */
  retainTail(maxRows: number): void {
    if (maxRows < 0) {
      throw new RangeError('maxRows must be >= 0')
    }
    if (this.length <= maxRows) {
      return
    }
    const drop = this.length - maxRows
    this.offsets.copyWithin(0, drop, this.length)
    this.lengths.copyWithin(0, drop, this.length)
    this.timestamps.copyWithin(0, drop, this.length)
    this.severities.copyWithin(0, drop, this.length)
    this.ids.copyWithin(0, drop, this.length)
    this.kinds.copyWithin(0, drop, this.length)
    this.componentIds.copyWithin(0, drop, this.length)
    this.ctxIds.copyWithin(0, drop, this.length)
    this.msgIds.copyWithin(0, drop, this.length)
    this.length = maxRows
  }

  getEntry(row: number): LogEntry {
    if (row < 0 || row >= this.length) {
      throw new RangeError(`row ${row} out of range 0..${this.length - 1}`)
    }
    const kind = this.kinds[row] === KIND_RAW ? 'raw' : 'json'
    return {
      row,
      kind,
      timestamp: this.timestamps[row]!,
      severity: this.severities[row]!,
      component: this.components.get(this.componentIds[row]!),
      id: this.ids[row]!,
      ctx: this.ctxs.get(this.ctxIds[row]!),
      msg: this.msgs.get(this.msgIds[row]!),
      offset: this.offsets[row]!,
      length: this.lengths[row]!,
    }
  }

  memoryEstimate(): MemoryEstimate {
    const typedArraysBytes =
      this.offsets.byteLength +
      this.lengths.byteLength +
      this.timestamps.byteLength +
      this.severities.byteLength +
      this.ids.byteLength +
      this.kinds.byteLength +
      this.componentIds.byteLength +
      this.ctxIds.byteLength +
      this.msgIds.byteLength

    const internBytes =
      this.components.estimateBytes() + this.ctxs.estimateBytes() + this.msgs.estimateBytes()

    return {
      typedArraysBytes,
      internBytes,
      totalBytes: typedArraysBytes + internBytes,
      rowCount: this.length,
      internCounts: {
        component: this.components.size,
        ctx: this.ctxs.size,
        msg: this.msgs.size,
      },
    }
  }
}

export function getEntry(store: LogStore, row: number): LogEntry {
  return store.getEntry(row)
}
