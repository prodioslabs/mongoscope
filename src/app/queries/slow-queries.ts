import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import {
  enableProfiling,
  fetchProfilerSlowQueriesSnapshot,
  type ProfilerSlowQueriesSnapshot,
} from '../../profiler'
import { liveConnectionManager } from '../../live-connection'
import { useLiveConnection } from '../stores/live-connection'
import { useProfilerPatternsStore } from '../stores/profiler-patterns'
import { useSession } from '../stores/session'

const slowQueriesKeys = {
  all: ['slow-queries'] as const,
  snapshot: (
    connectionId: string | null,
    generation: number,
    selectedDatabase: string | null,
    profilerFetchLimit: number,
  ) =>
    [
      ...slowQueriesKeys.all,
      'snapshot',
      connectionId,
      generation,
      selectedDatabase,
      profilerFetchLimit,
    ] as const,
}

export function useProfilerSlowQueriesSnapshot(enabled: boolean) {
  const connectionId = useLiveConnection((s) => s.connectionId)
  const generation = useLiveConnection((s) => s.generation)
  const liveStatus = useLiveConnection((s) => s.status)
  const activeTab = useSession((s) => s.activeTab)
  const selectedDatabase = useSession((s) => s.selectedDatabase)
  const profilerFetchLimit = useSession((s) => s.profilerFetchLimit)
  const setSnapshot = useProfilerPatternsStore((s) => s.setSnapshot)
  const clearPatterns = useProfilerPatternsStore((s) => s.clear)

  const pollingEnabled =
    enabled && liveStatus === 'connected' && activeTab === 'slow-queries' && connectionId != null

  const query = useQuery({
    queryKey: slowQueriesKeys.snapshot(
      connectionId,
      generation,
      selectedDatabase,
      profilerFetchLimit,
    ),
    enabled: pollingEnabled,
    refetchInterval: 2000,
    refetchIntervalInBackground: false,
    staleTime: 0,
    queryFn: async function fetchProfilerSlowQueriesQuery(): Promise<ProfilerSlowQueriesSnapshot> {
      const snapshotBefore = liveConnectionManager.getSnapshot()
      const generationAtStart = snapshotBefore.generation
      const client = liveConnectionManager.getActiveClient()
      if (client == null || snapshotBefore.status !== 'connected') {
        throw new Error('Not connected')
      }

      const { snapshot } = await fetchProfilerSlowQueriesSnapshot(client, selectedDatabase, {
        limit: profilerFetchLimit,
      })

      const snapshotAfter = liveConnectionManager.getSnapshot()
      if (
        snapshotAfter.generation !== generationAtStart ||
        snapshotAfter.status !== 'connected' ||
        liveConnectionManager.getActiveClient() == null
      ) {
        return {
          database: selectedDatabase ?? '',
          databases: [],
          profiling: null,
          patterns: [],
          samples: [],
          windowStartMs: 0,
          windowEndMs: 0,
          slowQueryCount: 0,
          errors: {
            databases: null,
            status: null,
            read: null,
            topology: null,
          },
        }
      }

      return snapshot
    },
  })

  useEffect(
    function syncProfilerPatternsMirror() {
      if (query.data == null) {
        return
      }
      setSnapshot({
        patterns: query.data.patterns,
        samples: query.data.samples,
        database: query.data.database,
      })
    },
    [query.data, setSnapshot],
  )

  useEffect(
    function clearProfilerPatternsOnDisconnect() {
      if (liveStatus !== 'connected') {
        clearPatterns()
      }
    },
    [clearPatterns, liveStatus],
  )

  const previousGenerationRef = useRef(generation)
  useEffect(
    function clearProfilerPatternsOnReconnect() {
      if (previousGenerationRef.current === generation) {
        return
      }
      previousGenerationRef.current = generation
      clearPatterns()
    },
    [clearPatterns, generation],
  )

  return query
}

export function useEnableProfiling() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async function executeEnable(input: { database: string; slowms: number }) {
      const client = liveConnectionManager.getActiveClient()
      return enableProfiling(client, input.database, input.slowms)
    },
    onSuccess: async function invalidateAfterEnable(result) {
      if (result.ok) {
        await queryClient.invalidateQueries({ queryKey: slowQueriesKeys.all })
      }
    },
  })
}
