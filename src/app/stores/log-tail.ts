import { create } from 'zustand'
import {
  createGetLogPoller,
  createLogTailer,
  filterTailLines,
  parseCustomFilterExpression,
  DEFAULT_ENABLED_CATEGORIES,
  LOG_TAIL_UI_COALESCE_MS,
  type CustomFilterExpression,
  type GetLogPoller,
  type LogCategoryComponent,
  type LogTailer,
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

type IngestMode = 'file' | 'live' | null

type LogTailState = {
  path: string | null
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
  /** Start or resume file tailing for path. */
  activateFile: (path: string) => void
  /** Start or resume getLog polling for connectionKey (`id:generation`). */
  activateLive: (connectionKey: string) => void
  deactivate: () => void
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

let fileTailer: LogTailer | null = null
let livePoller: GetLogPoller | null = null
let unsubscribe: (() => void) | null = null
let coalesceTimer: ReturnType<typeof setTimeout> | null = null
let activePath: string | null = null
let activeConnectionKey: string | null = null
let ingestMode: IngestMode = null

function clearCoalesceTimer(): void {
  if (coalesceTimer != null) {
    clearTimeout(coalesceTimer)
    coalesceTimer = null
  }
}

function flushSnapshot(set: (partial: Partial<LogTailState>) => void): void {
  clearCoalesceTimer()
  if (ingestMode === 'file' && fileTailer != null) {
    const snap = fileTailer.getSnapshot()
    set({
      lines: snap.lines,
      stats: snap.stats,
      error: snap.error,
    })
    return
  }
  if (ingestMode === 'live' && livePoller != null) {
    const snap = livePoller.getSnapshot()
    set({
      lines: snap.lines,
      stats: snap.stats,
      error: snap.error,
    })
  }
}

function scheduleFlush(set: (partial: Partial<LogTailState>) => void): void {
  if (coalesceTimer != null) {
    return
  }
  coalesceTimer = setTimeout(function flushCoalescedLogSnapshot() {
    coalesceTimer = null
    flushSnapshot(set)
  }, LOG_TAIL_UI_COALESCE_MS)
}

function detachAll(): void {
  clearCoalesceTimer()
  if (unsubscribe != null) {
    unsubscribe()
    unsubscribe = null
  }
  if (fileTailer != null) {
    fileTailer.stop()
    fileTailer = null
  }
  if (livePoller != null) {
    livePoller.stop()
    livePoller = null
  }
  ingestMode = null
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
  path: null,
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

  activateFile(path) {
    if (ingestMode === 'live') {
      detachAll()
      activeConnectionKey = null
    }

    if (activePath !== path || fileTailer == null) {
      detachAll()
      activePath = path
      ingestMode = 'file'
      set({
        path,
        connectionKey: null,
        lines: [],
        stats: EMPTY_STATS,
        error: null,
        following: true,
      })
      const next = createLogTailer({ path })
      fileTailer = next
      unsubscribe = next.subscribe(function onFileTailEmit() {
        scheduleFlush(set)
      })
      void next.start().then(function afterFileTailStart() {
        flushSnapshot(set)
      })
      return
    }

    if (!fileTailer.getSnapshot().running) {
      void fileTailer.start().then(function afterResume() {
        flushSnapshot(set)
      })
    }
    set({ path, connectionKey: null, following: get().following })
  },

  activateLive(connectionKey) {
    if (ingestMode === 'file') {
      detachAll()
      activePath = null
    }

    if (activeConnectionKey !== connectionKey || livePoller == null) {
      detachAll()
      activeConnectionKey = connectionKey
      ingestMode = 'live'
      set({
        path: null,
        connectionKey,
        lines: [],
        stats: EMPTY_STATS,
        error: null,
        following: true,
      })
      const next = createLiveGetLogPoller()
      livePoller = next
      unsubscribe = next.subscribe(function onGetLogEmit() {
        scheduleFlush(set)
      })
      void next.start().then(function afterGetLogStart() {
        flushSnapshot(set)
      })
      return
    }

    if (!livePoller.getSnapshot().running) {
      void livePoller.start().then(function afterResume() {
        flushSnapshot(set)
      })
    }
    set({ connectionKey, path: null, following: get().following })
  },

  deactivate() {
    if (fileTailer != null) {
      flushSnapshot(set)
      fileTailer.stop()
    }
    if (livePoller != null) {
      flushSnapshot(set)
      livePoller.stop()
    }
    clearCoalesceTimer()
  },

  teardown() {
    detachAll()
    activePath = null
    activeConnectionKey = null
    set({
      path: null,
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
