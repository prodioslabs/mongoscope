import { stat } from 'node:fs/promises'
import { match } from 'ts-pattern'
import { create } from 'zustand'
import { LogStore, parseLogFile } from '../../parser'
import { buildQueryPatternStore, type QueryPatternStore } from '../../query-patterns'
import { useLogTailStore } from './log-tail'

export type AppScreen = 'welcome' | 'dashboard'

export type AppTab = 'slow-queries' | 'live-ops' | 'replication' | 'indexes' | 'logs'

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
    set({ activeConnectionId: id, selectedDatabase: null })
  },

  setSelectedDatabase(database) {
    set({ selectedDatabase: database })
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
      logPath: path,
      logStore: null,
      queryPatterns: null,
      parseProgress: 0,
      parseDurationMs: null,
      parseError: null,
    })

    const startedAt = performance.now()

    try {
      const { size } = await stat(path)
      let latest: LogStore | null = null

      for await (const batch of parseLogFile(path, {
        onProgress({ bytesRead }) {
          set({ parseProgress: progressPercent(bytesRead, size) })
        },
      })) {
        latest = batch.store
      }

      const queryPatterns = latest != null ? await buildQueryPatternStore(latest) : null

      set({
        logStore: latest,
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
      parseProgress: null,
      parseDurationMs: null,
      parseError: null,
    })
  },
}))
