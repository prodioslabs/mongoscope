'use client'

import { createContext, use, useMemo, useState, type ReactNode } from 'react'
import type { SlowSort } from './demo-data'

/** State the demo cards share: Export follows the Slow Queries sort, Slow Queries opens Indexes. */
type FeatureDemos = {
  slowSort: SlowSort
  setSlowSort: (sort: SlowSort) => void
  indexesCollection: string
  setIndexesCollection: (collection: string) => void
  showIndexes: (collection: string) => void
  /** Bumped on each jump so the Indexes card replays its highlight. */
  indexesFlash: number
}

const FeatureDemosContext = createContext<FeatureDemos | null>(null)

export function useFeatureDemos() {
  const value = use(FeatureDemosContext)
  if (!value) {
    throw new Error('useFeatureDemos must be used inside FeatureDemosProvider')
  }
  return value
}

type FeatureDemosProviderProps = {
  children: ReactNode
}

export function FeatureDemosProvider({ children }: FeatureDemosProviderProps) {
  const [slowSort, setSlowSort] = useState<SlowSort>('avg')
  const [indexesCollection, setIndexesCollection] = useState('app.orders')
  const [indexesFlash, setIndexesFlash] = useState(0)

  const value = useMemo<FeatureDemos>(
    () => ({
      slowSort,
      setSlowSort,
      indexesCollection,
      setIndexesCollection,
      showIndexes(collection) {
        setIndexesCollection(collection)
        setIndexesFlash((count) => count + 1)
        document.getElementById('indexes-demo')?.scrollIntoView({
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
            ? 'auto'
            : 'smooth',
          block: 'center',
        })
      },
      indexesFlash,
    }),
    [slowSort, indexesCollection, indexesFlash],
  )

  return <FeatureDemosContext value={value}>{children}</FeatureDemosContext>
}
