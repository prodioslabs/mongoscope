import { LOG_TAIL_RING_CAPACITY, type TailLogLine } from './types'

/**
 * Fixed-capacity ring of tailed log lines. Oldest entries are dropped when full.
 */
export class LogLineRingBuffer {
  private readonly capacity: number
  private readonly slots: Array<TailLogLine | undefined>
  private start = 0
  private length = 0

  constructor(capacity: number = LOG_TAIL_RING_CAPACITY) {
    if (capacity < 1) {
      throw new RangeError('LogLineRingBuffer capacity must be >= 1')
    }
    this.capacity = capacity
    this.slots = new Array(capacity)
  }

  get size(): number {
    return this.length
  }

  get maxCapacity(): number {
    return this.capacity
  }

  push(line: TailLogLine): void {
    if (this.length < this.capacity) {
      const index = (this.start + this.length) % this.capacity
      this.slots[index] = line
      this.length++
      return
    }
    this.slots[this.start] = line
    this.start = (this.start + 1) % this.capacity
  }

  pushMany(lines: ReadonlyArray<TailLogLine>): void {
    for (const line of lines) {
      this.push(line)
    }
  }

  clear(): void {
    this.slots.fill(undefined)
    this.start = 0
    this.length = 0
  }

  /** Oldest → newest snapshot (copies references, not deep-cloned). */
  toArray(): TailLogLine[] {
    const out: TailLogLine[] = new Array(this.length)
    for (let i = 0; i < this.length; i++) {
      out[i] = this.slots[(this.start + i) % this.capacity]!
    }
    return out
  }
}
