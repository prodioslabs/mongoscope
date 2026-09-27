import { access, constants, stat } from 'node:fs/promises'
import { match } from 'ts-pattern'
import { create } from 'zustand'
import {
  DEFAULT_LOG_TAIL_LINES,
  LogStore,
  MAX_READ_BYTES,
  clampLogTailLines,
  parseLogFileTail,
} from '../../parser'
import {
  DEFAULT_PROFILE_FETCH_LIMIT,
  MAX_PROFILE_FETCH_LIMIT,
  MIN_PROFILE_FETCH_LIMIT,
} from '../../profiler'
import { buildQueryPatternStore, type QueryPatternStore } from '../../query-patterns'
import { errorMessageText } from '../../lib/error-message'
import {
  isFsPermissionDeniedError,
  materializeLogFileTailElevated,
  unlinkElevatedTempFile,
  type SuspendableRenderer,
} from '../lib/elevated-log-access'
import { useLogTailStore } from './log-tail'

type AppScreen = 'welcome' | 'dashboard'

export type AppTab = 'slow-queries' | 'live-ops' | 'replication' | 'indexes' | 'logs'

/** Session-only live connection from CLI flags — never persisted to the keychain. */
export const CLI_EPHEMERAL_CONNECTION_ID = 'cli-ephemeral'

type DataSourceMode = 'static' | 'live'

type SlowQueriesPendingNavigation = {
  patternId?: number
  openDetail?: boolean
  statusMessage?: string
}

/** Cross-tab jump from Slow Queries suggestIndex (or namespace) into Indexes. */
type IndexesPendingNavigation = {
  database: string
  collection: string
  /** Compact key label from ESR suggestion, when present. */
  suggestedKeyLabel?: string
  suggestedCommand?: string
  suggestedReason?: string
  statusMessage?: string
}

/** Sticky Slow Queries suggestion shown on Indexes until dismissed or left. */
type IndexesSuggestionContext = {
  database: string
  collection: string
  keyLabel?: string
  command?: string
  reason?: string
}

type TabNavigationContext = {
  slowQueries?: SlowQueriesPendingNavigation
  indexes?: IndexesPendingNavigation
}

type TabDefinition = {
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
  /**
   * URI for {@link CLI_EPHEMERAL_CONNECTION_ID} only. Never logged; cleared when leaving ephemeral.
   */
  ephemeralLiveUri: string | null
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
  /** Temp copy from elevated sudo read; unlinked on next parse / reset. */
  elevatedTempPath: string | null
  setTab: (tab: AppTab) => void
  navigateToTab: (tab: AppTab, context?: TabNavigationContext) => void
  consumePendingSlowQueriesNav: () => SlowQueriesPendingNavigation | null
  consumePendingIndexesNav: () => IndexesPendingNavigation | null
  clearIndexesSuggestion: () => void
  /** Align sticky suggestion names after case-insensitive DB/collection resolve. */
  alignIndexesSuggestion: (database: string, collection: string) => void
  setScreen: (screen: AppScreen) => void
  setActiveConnectionId: (id: string | null) => void
  /** Activate a one-shot CLI live connection without writing to the OS keychain. */
  activateEphemeralLiveConnection: (uri: string) => void
  setSelectedDatabase: (database: string | null) => void
  setSlowQueriesSource: (source: DataSourceMode) => void
  setLogsSource: (source: DataSourceMode) => void
  setLogTailLines: (lines: number) => Promise<void>
  setProfilerFetchLimit: (limit: number) => void
  goToWelcome: () => void
  startParse: (
    path: string,
    options?: { elevatedRenderer?: SuspendableRenderer },
  ) => Promise<'ok' | 'permission_denied' | 'error'>
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

async function clearElevatedTemp(
  get: () => SessionState,
  set: (partial: Partial<SessionState>) => void,
): Promise<void> {
  const previous = get().elevatedTempPath
  set({ elevatedTempPath: null })
  await unlinkElevatedTempFile(previous)
}

async function runTailParse(
  path: string,
  maxLines: number,
  get: () => SessionState,
  set: (partial: Partial<SessionState>) => void,
  elevatedRenderer?: SuspendableRenderer,
): Promise<'ok' | 'permission_denied' | 'error'> {
  const startedAt = performance.now()
  set({
    logPath: path,
    logStore: null,
    queryPatterns: null,
    parseProgress: 0,
    parseDurationMs: null,
    parseError: null,
  })

  let readPath = path
  let createdTemp: string | null = null
  const existingTemp = get().elevatedTempPath

  try {
    if (elevatedRenderer != null) {
      await clearElevatedTemp(get, set)
      const materialized = await materializeLogFileTailElevated({
        renderer: elevatedRenderer,
        path,
        maxBytes: MAX_READ_BYTES,
      })
      if (!materialized.ok) {
        set({
          parseProgress: null,
          parseDurationMs: null,
          parseError: materialized.message,
          logStore: null,
          queryPatterns: null,
        })
        return materialized.kind === 'denied' || materialized.kind === 'cancelled'
          ? 'permission_denied'
          : 'error'
      }
      createdTemp = materialized.value
      readPath = materialized.value
      set({ elevatedTempPath: createdTemp })
    } else if (existingTemp != null) {
      // Re-parse (e.g. log-tail size change) from the elevated temp copy.
      readPath = existingTemp
    } else {
      try {
        await access(path, constants.R_OK)
      } catch (error) {
        if (isFsPermissionDeniedError(error)) {
          set({
            parseProgress: null,
            parseDurationMs: null,
            parseError:
              'Permission denied reading this log file — press r to retry with sudo',
            logStore: null,
            queryPatterns: null,
          })
          return 'permission_denied'
        }
        throw error
      }
    }

    const { size } = await stat(readPath)
    const store = await parseLogFileTail(readPath, {
      maxLines,
      onProgress({ bytesRead }) {
        set({ parseProgress: progressPercent(bytesRead, size) })
      },
    })
    const queryPatterns = await buildQueryPatternStore(store)
    set({
      logPath: path,
      logStore: store,
      queryPatterns,
      parseProgress: null,
      parseDurationMs: Math.round(performance.now() - startedAt),
      parseError: null,
      screen: 'dashboard',
      activeTab: 'slow-queries',
    })
    return 'ok'
  } catch (error) {
    if (createdTemp != null) {
      await unlinkElevatedTempFile(createdTemp)
      set({ elevatedTempPath: null })
    }
    if (isFsPermissionDeniedError(error)) {
      set({
        parseProgress: null,
        parseDurationMs: null,
        parseError: 'Permission denied reading this log file — press r to retry with sudo',
        logStore: null,
        queryPatterns: null,
      })
      return 'permission_denied'
    }
    const message = errorMessageText(error)
    set({
      parseProgress: null,
      parseDurationMs: null,
      parseError: message,
      logStore: null,
      queryPatterns: null,
    })
    return 'error'
  }
}

export const useSession = create<SessionState>((set, get) => ({
  screen: 'welcome',
  activeTab: 'slow-queries',
  activeConnectionId: null,
  ephemeralLiveUri: null,
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
  elevatedTempPath: null,

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
        ephemeralLiveUri: null,
        selectedDatabase: null,
        slowQueriesSource: 'static',
        logsSource: 'static',
      })
      return
    }
    set({
      activeConnectionId: id,
      ephemeralLiveUri: null,
      selectedDatabase: null,
    })
  },

  activateEphemeralLiveConnection(uri) {
    const trimmed = uri.trim()
    if (trimmed === '') {
      throw new Error('uri must be a non-empty string')
    }
    set({
      activeConnectionId: CLI_EPHEMERAL_CONNECTION_ID,
      ephemeralLiveUri: trimmed,
      selectedDatabase: null,
    })
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
    await runTailParse(path, next, get, set)
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

  async startParse(path, options) {
    if (get().parseProgress !== null) {
      return 'error'
    }
    useLogTailStore.getState().teardown()
    set({
      slowQueriesSource: 'static',
      logsSource: 'static',
    })
    return await runTailParse(path, get().logTailLines, get, set, options?.elevatedRenderer)
  },

  resetToWelcome() {
    const previousTemp = get().elevatedTempPath
    useLogTailStore.getState().teardown()
    set({
      screen: 'welcome',
      activeTab: 'slow-queries',
      activeConnectionId: null,
      ephemeralLiveUri: null,
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
      elevatedTempPath: null,
    })
    void unlinkElevatedTempFile(previousTemp)
  },
}))
