import { stat } from 'node:fs/promises'
import { match } from 'ts-pattern'
import { create } from 'zustand'
import { LogStore, parseLogFile } from '../../parser'
import { buildQueryPatternStore, type QueryPatternStore } from '../../query-patterns'

export type AppScreen = 'welcome' | 'dashboard'

export type AppTab = 'slow-queries' | 'live-ops' | 'timeline' | 'replication' | 'indexes' | 'logs'

export type TabDefinition = {
  id: AppTab
  key: string
  label: string
}

export const TABS: readonly TabDefinition[] = [
  { id: 'slow-queries', key: '1', label: 'Slow Queries' },
  { id: 'live-ops', key: '2', label: 'Live Ops' },
  { id: 'timeline', key: '3', label: 'Timeline' },
  { id: 'replication', key: '4', label: 'Replication' },
  { id: 'indexes', key: '5', label: 'Indexes' },
  { id: 'logs', key: '6', label: 'Logs' },
] as const

export function tabFromKey(key: string): AppTab | null {
  return match(key)
    .with('1', () => 'slow-queries' as const)
    .with('2', () => 'live-ops' as const)
    .with('3', () => 'timeline' as const)
    .with('4', () => 'replication' as const)
    .with('5', () => 'indexes' as const)
    .with('6', () => 'logs' as const)
    .otherwise(() => null)
}

type SessionState = {
  screen: AppScreen
  activeTab: AppTab
  /** Selected connection for Live Ops / Indexes (session-only; not persisted). */
  activeConnectionId: string | null
  logPath: string | null
  logStore: LogStore | null
  queryPatterns: QueryPatternStore | null
  /** 0–100 while parsing; null when idle */
  parseProgress: number | null
  /** Wall-clock ms for the last successful parse; null until then */
  parseDurationMs: number | null
  parseError: string | null
  setTab: (tab: AppTab) => void
  setScreen: (screen: AppScreen) => void
  setActiveConnectionId: (id: string | null) => void
  goToWelcome: () => void
  startParse: (path: string) => Promise<void>
  resetToWelcome: () => void
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
  logPath: null,
  logStore: null,
  queryPatterns: null,
  parseProgress: null,
  parseDurationMs: null,
  parseError: null,

  setTab(tab) {
    set({ activeTab: tab })
  },

  setScreen(screen) {
    set({ screen })
  },

  setActiveConnectionId(id) {
    set({ activeConnectionId: id })
  },

  goToWelcome() {
    set({ screen: 'welcome' })
  },

  async startParse(path) {
    if (get().parseProgress !== null) {
      return
    }

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
    set({
      screen: 'welcome',
      activeTab: 'slow-queries',
      activeConnectionId: null,
      logPath: null,
      logStore: null,
      queryPatterns: null,
      parseProgress: null,
      parseDurationMs: null,
      parseError: null,
    })
  },
}))
