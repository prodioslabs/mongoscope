import { stat } from 'node:fs/promises'
import { match } from 'ts-pattern'
import { create } from 'zustand'
import {
  DEFAULT_LOG_TAIL_LINES,
  LogStore,
  clampLogTailLines,
  parseLogFileTail,
} from '../../parser'
import {
  DEFAULT_PROFILE_FETCH_LIMIT,
  MAX_PROFILE_FETCH_LIMIT,
  MIN_PROFILE_FETCH_LIMIT,
} from '../../profiler'
import { buildQueryPatternStore, type QueryPatternStore } from '../../query-patterns'
import { useLogTailStore } from './log-tail'

export type AppScreen = 'welcome' | 'dashboard'

export type AppTab = 'slow-queries' | 'live-ops' | 'replication' | 'indexes' | 'logs'

export type DataSourceMode = 'static' | 'live'

export type SlowQueriesPendingNavigation = {
  patternId?: number
  openDetail?: boolean
  statusMessage?: string
}

/** Cross-tab jump from Slow Queries suggestIndex (or namespace) into Indexes. */
export type IndexesPendingNavigation = {
  database: string
  collection: string
  /** Compact key label from ESR suggestion, when present. */
  suggestedKeyLabel?: string
  suggestedCommand?: string
  suggestedReason?: string
  statusMessage?: string
}

/** Sticky Slow Queries suggestion shown on Indexes until dismissed or left. */
export type IndexesSuggestionContext = {
  database: string
  collection: string
  keyLabel?: string
  command?: string
  reason?: string
}

export type TabNavigationContext = {
  slowQueries?: SlowQueriesPendingNavigation
  indexes?: IndexesPendingNavigation
}

export type TabDefinition = {
  id: AppTab
  key: string
  label: string
}

export const TABS: readonly TabDefinition[] = [
  { id: 'slow-queries', key: '1', label: 'Slow Queries' },
  { id: 'live-ops', key: '2', label: 'Live Ops' },
  { id: 'replication', key: '3', label: 'Replication' },
  { id: 'indexes', key: '4', label: 'Indexes' },
  { id: 'logs', key: '5', label: 'Logs' },
] as const

export function tabFromKey(key: string): AppTab | null {
  return match(key)
    .with('1', () => 'slow-queries' as const)
    .with('2', () => 'live-ops' as const)
    .with('3', () => 'replication' as const)
    .with('4', () => 'indexes' as const)
    .with('5', () => 'logs' as const)
    .otherwise(() => null)
}

type SessionState = {
  screen: AppScreen
  activeTab: AppTab
  /** Selected connection for Live Ops / Replication / Indexes (session-only; not persisted). */
  activeConnectionId: string | null
  /** Selected MongoDB database for Indexes (session-only; cleared on connection change). */
  selectedDatabase: string | null
  /** Consumed once when Slow Queries tab mounts after cross-tab navigation. */
  pendingSlowQueriesNav: SlowQueriesPendingNavigation | null
  /** Consumed once when Indexes tab/dashboard mounts after cross-tab navigation. */
  pendingIndexesNav: IndexesPendingNavigation | null
  /** Sticky suggested-index banner for Indexes (survives remount; cleared on leave). */
  indexesSuggestion: IndexesSuggestionContext | null
  logPath: string | null
  logStore: LogStore | null
  queryPatterns: QueryPatternStore | null
  /** Last-N-lines window for static Slow Queries parse (welcome / reparse). */
  logTailLines: number
  /** How many newest system.profile docs to fetch in live Slow Queries. */
  profilerFetchLimit: number
  /** Static file vs live profiler; live only meaningful when a connection is selected. */
  slowQueriesSource: DataSourceMode
  /** Static file tail vs getLog; live only meaningful when a connection is selected. */
  logsSource: DataSourceMode
  /** 0–100 while parsing; null when idle */
  parseProgress: number | null
  /** Wall-clock ms for the last successful parse; null until then */
  parseDurationMs: number | null
  parseError: string | null
  setTab: (tab: AppTab) => void
  navigateToTab: (tab: AppTab, context?: TabNavigationContext) => void
  consumePendingSlowQueriesNav: () => SlowQueriesPendingNavigation | null
  consumePendingIndexesNav: () => IndexesPendingNavigation | null
  clearIndexesSuggestion: () => void
  /** Align sticky suggestion names after case-insensitive DB/collection resolve. */
  alignIndexesSuggestion: (database: string, collection: string) => void
  setScreen: (screen: AppScreen) => void
  setActiveConnectionId: (id: string | null) => void
  setSelectedDatabase: (database: string | null) => void
  setSlowQueriesSource: (source: DataSourceMode) => void
  setLogsSource: (source: DataSourceMode) => void
  setLogTailLines: (lines: number) => Promise<void>
  setProfilerFetchLimit: (limit: number) => void
  goToWelcome: () => void
  startParse: (path: string) => Promise<void>
  resetToWelcome: () => void
}

function suggestionFromIndexesNav(
  pending: IndexesPendingNavigation,
): IndexesSuggestionContext | null {
  if (
    pending.suggestedCommand == null &&
    pending.suggestedKeyLabel == null &&
    pending.suggestedReason == null
  ) {
    return null
  }
  return {
    database: pending.database,
    collection: pending.collection,
    keyLabel: pending.suggestedKeyLabel,
    command: pending.suggestedCommand,
    reason: pending.suggestedReason,
  }
}

function progressPercent(bytesRead: number, fileSize: number): number {
  if (fileSize === 0) {
    return 100
  }
  return Math.min(100, Math.round((bytesRead / fileSize) * 100))
}

async function runTailParse(
  path: string,
  maxLines: number,
  set: (partial: Partial<SessionState>) => void,
): Promise<void> {
  const startedAt = performance.now()
  set({
    logPath: path,
    logStore: null,
    queryPatterns: null,
    parseProgress: 0,
    parseDurationMs: null,
    parseError: null,
  })

  try {
    const { size } = await stat(path)
    const store = await parseLogFileTail(path, {
      maxLines,
      onProgress({ bytesRead }) {
        set({ parseProgress: progressPercent(bytesRead, size) })
      },
    })
    const queryPatterns = await buildQueryPatternStore(store)
    set({
      logStore: store,
      queryPatterns,
      parseProgress: null,
      parseDurationMs: Math.round(performance.now() - startedAt),
      parseError: null,
      screen: 'dashboard',
      activeTab: 'slow-queries',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    set({
      parseProgress: null,
      parseDurationMs: null,
      parseError: message,
      logStore: null,
      queryPatterns: null,
    })
  }
}

export const useSession = create<SessionState>((set, get) => ({
  screen: 'welcome',
  activeTab: 'slow-queries',
  activeConnectionId: null,
  selectedDatabase: null,
  pendingSlowQueriesNav: null,
  pendingIndexesNav: null,
  indexesSuggestion: null,
  logPath: null,
  logStore: null,
  queryPatterns: null,
  logTailLines: DEFAULT_LOG_TAIL_LINES,
  profilerFetchLimit: DEFAULT_PROFILE_FETCH_LIMIT,
  slowQueriesSource: 'static',
  logsSource: 'static',
  parseProgress: null,
  parseDurationMs: null,
  parseError: null,

  setTab(tab) {
    if (tab === 'indexes') {
      set({ activeTab: tab })
      return
    }
    set({
      activeTab: tab,
      pendingIndexesNav: null,
      indexesSuggestion: null,
    })
  },

  navigateToTab(tab, context) {
    const indexesNav = context?.indexes ?? null
    set({
      activeTab: tab,
      pendingSlowQueriesNav: context?.slowQueries ?? null,
      pendingIndexesNav: indexesNav,
      indexesSuggestion:
        indexesNav != null
          ? suggestionFromIndexesNav(indexesNav)
          : tab === 'indexes'
            ? get().indexesSuggestion
            : null,
    })
  },

  consumePendingSlowQueriesNav() {
    const pending = get().pendingSlowQueriesNav
    if (pending == null) {
      return null
    }
    set({ pendingSlowQueriesNav: null })
    return pending
  },

  consumePendingIndexesNav() {
    const pending = get().pendingIndexesNav
    if (pending == null) {
      return null
    }
    set({ pendingIndexesNav: null })
    return pending
  },

  clearIndexesSuggestion() {
    set({ indexesSuggestion: null })
  },

  alignIndexesSuggestion(database, collection) {
    const current = get().indexesSuggestion
    if (current == null) {
      return
    }
    if (current.database === database && current.collection === collection) {
      return
    }
    set({
      indexesSuggestion: {
        ...current,
        database,
        collection,
      },
    })
  },

  setScreen(screen) {
    set({ screen })
  },

  setActiveConnectionId(id) {
    if (id == null) {
      set({
        activeConnectionId: null,
        selectedDatabase: null,
        slowQueriesSource: 'static',
        logsSource: 'static',
      })
      return
    }
    set({ activeConnectionId: id, selectedDatabase: null })
  },

  setSelectedDatabase(database) {
    set({ selectedDatabase: database })
  },

  setSlowQueriesSource(source) {
    if (source === 'live' && get().activeConnectionId == null) {
      return
    }
    set({ slowQueriesSource: source })
  },

  setLogsSource(source) {
    if (source === 'live' && get().activeConnectionId == null) {
      return
    }
    set({ logsSource: source })
  },

  async setLogTailLines(lines) {
    if (get().parseProgress !== null) {
      return
    }
    const next = clampLogTailLines(lines)
    if (next === get().logTailLines && get().logStore != null) {
      return
    }
    set({ logTailLines: next })
    const path = get().logPath
    if (path == null) {
      return
    }
    useLogTailStore.getState().teardown()
    await runTailParse(path, next, set)
  },

  setProfilerFetchLimit(limit) {
    const next = Math.min(
      MAX_PROFILE_FETCH_LIMIT,
      Math.max(MIN_PROFILE_FETCH_LIMIT, Math.floor(limit)),
    )
    if (!Number.isFinite(next) || next === get().profilerFetchLimit) {
      return
    }
    set({ profilerFetchLimit: next })
  },

  goToWelcome() {
    set({ screen: 'welcome' })
  },

  async startParse(path) {
    if (get().parseProgress !== null) {
      return
    }
    useLogTailStore.getState().teardown()
    set({
      slowQueriesSource: 'static',
      logsSource: 'static',
    })
    await runTailParse(path, get().logTailLines, set)
  },

  resetToWelcome() {
    useLogTailStore.getState().teardown()
    set({
      screen: 'welcome',
      activeTab: 'slow-queries',
      activeConnectionId: null,
      selectedDatabase: null,
      pendingSlowQueriesNav: null,
      pendingIndexesNav: null,
      indexesSuggestion: null,
      logPath: null,
      logStore: null,
      queryPatterns: null,
      logTailLines: DEFAULT_LOG_TAIL_LINES,
      profilerFetchLimit: DEFAULT_PROFILE_FETCH_LIMIT,
      slowQueriesSource: 'static',
      logsSource: 'static',
      parseProgress: null,
      parseDurationMs: null,
      parseError: null,
    })
  },
}))
