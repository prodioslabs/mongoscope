import { create } from 'zustand'
import {
  createGetLogPoller,
  filterTailLines,
  parseCustomFilterExpression,
  DEFAULT_ENABLED_CATEGORIES,
  LOG_TAIL_UI_COALESCE_MS,
  type CustomFilterExpression,
  type GetLogPoller,
  type LogCategoryComponent,
  type LogTailStats,
  type TailLogLine,
} from '../../log-tail'
import { liveConnectionManager } from '../../live-connection'

const EMPTY_STATS: LogTailStats = {
  format: 'raw/legacy',
  linesPerSec: 0,
  restartsDetected: 0,
  bufferedCount: 0,
}

type LogTailState = {
  /** Connection key currently driving the poller (`id:generation`), or null. */
  connectionKey: string | null
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
  /** Start or resume getLog polling for this connection generation. */
  activate: (connectionKey: string) => void
  /** Stop polling; retain buffer. */
  deactivate: () => void
  /** Full teardown (disconnect / resetToWelcome). */
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

let poller: GetLogPoller | null = null
let unsubscribePoller: (() => void) | null = null
let coalesceTimer: ReturnType<typeof setTimeout> | null = null
let activeConnectionKey: string | null = null

function clearCoalesceTimer(): void {
  if (coalesceTimer != null) {
    clearTimeout(coalesceTimer)
    coalesceTimer = null
  }
}

function flushSnapshot(set: (partial: Partial<LogTailState>) => void): void {
  clearCoalesceTimer()
  if (poller == null) {
    return
  }
  const snap = poller.getSnapshot()
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
  coalesceTimer = setTimeout(function flushCoalescedGetLogSnapshot() {
    coalesceTimer = null
    flushSnapshot(set)
  }, LOG_TAIL_UI_COALESCE_MS)
}

function detachPoller(): void {
  clearCoalesceTimer()
  if (unsubscribePoller != null) {
    unsubscribePoller()
    unsubscribePoller = null
  }
  if (poller != null) {
    poller.stop()
    poller = null
  }
}

function createLiveGetLogPoller(): GetLogPoller {
  return createGetLogPoller({
    async fetchLog() {
      const snapshot = liveConnectionManager.getSnapshot()
      const client = liveConnectionManager.getActiveClient()
      if (client == null || snapshot.status !== 'connected') {
        throw new Error('Not connected')
      }
      return client.db('admin').admin().command({ getLog: 'global' })
    },
  })
}

export const useLogTailStore = create<LogTailState>((set, get) => ({
  connectionKey: null,
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

  activate(connectionKey) {
    if (activeConnectionKey !== connectionKey) {
      detachPoller()
      activeConnectionKey = connectionKey
      set({
        connectionKey,
        lines: [],
        stats: EMPTY_STATS,
        error: null,
        following: true,
      })
      const next = createLiveGetLogPoller()
      poller = next
      unsubscribePoller = next.subscribe(function onGetLogEmit() {
        scheduleFlush(set)
      })
      void next.start().then(function afterGetLogStart() {
        flushSnapshot(set)
      })
      return
    }

    if (poller == null) {
      activeConnectionKey = connectionKey
      const next = createLiveGetLogPoller()
      poller = next
      unsubscribePoller = next.subscribe(function onGetLogEmit() {
        scheduleFlush(set)
      })
      void next.start().then(function afterGetLogStart() {
        flushSnapshot(set)
      })
      set({ connectionKey, following: get().following })
      return
    }

    if (!poller.getSnapshot().running) {
      void poller.start().then(function afterResume() {
        flushSnapshot(set)
      })
    }
  },

  deactivate() {
    if (poller != null) {
      flushSnapshot(set)
      poller.stop()
    }
    clearCoalesceTimer()
  },

  teardown() {
    detachPoller()
    activeConnectionKey = null
    set({
      connectionKey: null,
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
