import { create } from 'zustand'
import {
  createLogTailer,
  filterTailLines,
  parseCustomFilterExpression,
  DEFAULT_ENABLED_CATEGORIES,
  LOG_CATEGORY_COMPONENTS,
  LOG_TAIL_UI_COALESCE_MS,
  type CustomFilterExpression,
  type LogCategoryComponent,
  type LogTailer,
  type LogTailStats,
  type TailLogLine,
} from '../../log-tail'

const EMPTY_STATS: LogTailStats = {
  format: 'raw/legacy',
  linesPerSec: 0,
  restartsDetected: 0,
  bufferedCount: 0,
}

type LogTailState = {
  path: string | null
  lines: TailLogLine[]
  stats: LogTailStats
  error: string | null
  following: boolean
  enabledCategories: ReadonlySet<LogCategoryComponent>
  customFilterText: string
  customFilter: CustomFilterExpression | null
  customFilterError: string | null
  search: string
  searchEditing: boolean
  filterEditing: boolean
  /** Start or resume polling for path; keeps buffer across pause. */
  activate: (path: string) => void
  /** Stop polling; retain buffer + offset. */
  deactivate: () => void
  /** Full teardown (path change / resetToWelcome). */
  teardown: () => void
  setFollowing: (following: boolean) => void
  toggleCategory: (component: LogCategoryComponent) => void
  setSearch: (search: string) => void
  setSearchEditing: (editing: boolean) => void
  setCustomFilterText: (text: string) => void
  applyCustomFilter: () => void
  clearCustomFilter: () => void
  setFilterEditing: (editing: boolean) => void
}

let tailer: LogTailer | null = null
let unsubscribeTailer: (() => void) | null = null
let coalesceTimer: ReturnType<typeof setTimeout> | null = null
let activePath: string | null = null

function clearCoalesceTimer(): void {
  if (coalesceTimer != null) {
    clearTimeout(coalesceTimer)
    coalesceTimer = null
  }
}

function flushSnapshot(set: (partial: Partial<LogTailState>) => void): void {
  clearCoalesceTimer()
  if (tailer == null) {
    return
  }
  const snap = tailer.getSnapshot()
  set({
    lines: snap.lines,
    stats: snap.stats,
    error: snap.error,
  })
}

function scheduleFlush(set: (partial: Partial<LogTailState>) => void): void {
  if (coalesceTimer != null) {
    return
  }
  coalesceTimer = setTimeout(function flushCoalescedTailSnapshot() {
    coalesceTimer = null
    flushSnapshot(set)
  }, LOG_TAIL_UI_COALESCE_MS)
}

function detachTailer(): void {
  clearCoalesceTimer()
  if (unsubscribeTailer != null) {
    unsubscribeTailer()
    unsubscribeTailer = null
  }
  if (tailer != null) {
    tailer.stop()
    tailer = null
  }
}

export const useLogTailStore = create<LogTailState>((set, get) => ({
  path: null,
  lines: [],
  stats: EMPTY_STATS,
  error: null,
  following: true,
  enabledCategories: new Set(DEFAULT_ENABLED_CATEGORIES),
  customFilterText: '',
  customFilter: null,
  customFilterError: null,
  search: '',
  searchEditing: false,
  filterEditing: false,

  activate(path) {
    if (activePath !== path) {
      detachTailer()
      activePath = path
      set({
        path,
        lines: [],
        stats: EMPTY_STATS,
        error: null,
        following: true,
      })
      const next = createLogTailer({ path })
      tailer = next
      unsubscribeTailer = next.subscribe(function onTailerEmit() {
        scheduleFlush(set)
      })
      void next.start().then(function afterTailerStart() {
        flushSnapshot(set)
      })
      return
    }

    if (tailer == null) {
      activePath = path
      const next = createLogTailer({ path })
      tailer = next
      unsubscribeTailer = next.subscribe(function onTailerEmit() {
        scheduleFlush(set)
      })
      void next.start().then(function afterTailerStart() {
        flushSnapshot(set)
      })
      set({ path, following: get().following })
      return
    }

    // Same path: resume polling if stopped (tab re-entered).
    if (!tailer.getSnapshot().running) {
      void tailer.start().then(function afterResume() {
        flushSnapshot(set)
      })
    }
  },

  deactivate() {
    if (tailer != null) {
      flushSnapshot(set)
      tailer.stop()
    }
    clearCoalesceTimer()
  },

  teardown() {
    detachTailer()
    activePath = null
    set({
      path: null,
      lines: [],
      stats: EMPTY_STATS,
      error: null,
      following: true,
      enabledCategories: new Set(DEFAULT_ENABLED_CATEGORIES),
      customFilterText: '',
      customFilter: null,
      customFilterError: null,
      search: '',
      searchEditing: false,
      filterEditing: false,
    })
  },

  setFollowing(following) {
    set({ following })
  },

  toggleCategory(component) {
    const next = new Set(get().enabledCategories)
    if (next.has(component)) {
      next.delete(component)
    } else {
      next.add(component)
    }
    set({ enabledCategories: next })
  },

  setSearch(search) {
    set({ search })
  },

  setSearchEditing(editing) {
    set({ searchEditing: editing })
  },

  setCustomFilterText(text) {
    set({ customFilterText: text })
  },

  applyCustomFilter() {
    const text = get().customFilterText.trim()
    if (text.length === 0) {
      set({ customFilter: null, customFilterError: null, filterEditing: false })
      return
    }
    const parsed = parseCustomFilterExpression(text)
    if (!parsed.ok) {
      set({ customFilter: null, customFilterError: parsed.error, filterEditing: false })
      return
    }
    set({
      customFilter: parsed.expression,
      customFilterError: null,
      customFilterText: text,
      filterEditing: false,
    })
  },

  clearCustomFilter() {
    set({
      customFilter: null,
      customFilterError: null,
      customFilterText: '',
      filterEditing: false,
    })
  },

  setFilterEditing(editing) {
    set({ filterEditing: editing })
  },
}))

export function selectFilteredLogLines(state: {
  lines: TailLogLine[]
  enabledCategories: ReadonlySet<string>
  customFilter: CustomFilterExpression | null
  search: string
}): TailLogLine[] {
  return filterTailLines(state.lines, {
    enabledCategories: state.enabledCategories,
    customFilter: state.customFilter,
    search: state.search,
  })
}
