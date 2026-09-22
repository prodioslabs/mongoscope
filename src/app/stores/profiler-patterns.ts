import { create } from 'zustand'
import type { QueryPattern } from '../../query-patterns'

type ProfilerPatternsState = {
  patterns: QueryPattern[]
  samples: Record<string, unknown>[]
  database: string | null
  setSnapshot: (next: {
    patterns: QueryPattern[]
    samples: Record<string, unknown>[]
    database: string
  }) => void
  clear: () => void
}

/**
 * Latest live profiler patterns for cross-tab consumers (Live Ops explain jump).
 * Updated by the Slow Queries poll hook; does not touch session.queryPatterns.
 */
export const useProfilerPatternsStore = create<ProfilerPatternsState>((set) => ({
  patterns: [],
  samples: [],
  database: null,
  setSnapshot(next) {
    set({
      patterns: next.patterns,
      samples: next.samples,
      database: next.database,
    })
  },
  clear() {
    set({ patterns: [], samples: [], database: null })
  },
}))
