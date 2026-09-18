import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { fetchIndexesSnapshot, type IndexesSnapshot } from '../../indexes'
import { liveConnectionManager } from '../../live-connection'
import { useLiveConnection } from '../stores/live-connection'
import { useSession } from '../stores/session'

export const indexesKeys = {
  all: ['indexes'] as const,
  snapshot: (connectionId: string | null, generation: number, selectedDatabase: string | null) =>
    [...indexesKeys.all, 'snapshot', connectionId, generation, selectedDatabase] as const,
}

export function useIndexesSnapshot(enabled: boolean) {
  const connectionId = useLiveConnection((s) => s.connectionId)
  const generation = useLiveConnection((s) => s.generation)
  const liveStatus = useLiveConnection((s) => s.status)
  const activeTab = useSession((s) => s.activeTab)
  const selectedDatabase = useSession((s) => s.selectedDatabase)

  const pollingEnabled =
    enabled && liveStatus === 'connected' && activeTab === 'indexes' && connectionId != null

  return useQuery({
    queryKey: indexesKeys.snapshot(connectionId, generation, selectedDatabase),
    enabled: pollingEnabled,
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
    staleTime: 0,
    placeholderData: keepPreviousData,
    queryFn: async function fetchIndexesQuery(): Promise<IndexesSnapshot> {
      const snapshotBefore = liveConnectionManager.getSnapshot()
      const generationAtStart = snapshotBefore.generation
      const client = liveConnectionManager.getActiveClient()
      if (client == null || snapshotBefore.status !== 'connected') {
        throw new Error('Not connected')
      }

      const { snapshot } = await fetchIndexesSnapshot(client, selectedDatabase)

      const snapshotAfter = liveConnectionManager.getSnapshot()
      if (
        snapshotAfter.generation !== generationAtStart ||
        snapshotAfter.status !== 'connected' ||
        liveConnectionManager.getActiveClient() == null
      ) {
        // Keep prior UI state via placeholderData; do not publish an empty list
        // that would clear selectedDatabase and retrigger this query.
        throw new Error('Connection changed during indexes fetch')
      }

      return snapshot
    },
  })
}
