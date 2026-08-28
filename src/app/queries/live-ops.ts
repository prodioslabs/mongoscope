import { useQuery } from '@tanstack/react-query'
import {
  computeTopDeltas,
  fetchLiveOpsSnapshot,
  type LiveOpsSnapshot,
  type TopSample,
} from '../../live-ops'
import { liveConnectionManager } from '../../live-connection'
import { useLiveConnection } from '../stores/live-connection'
import { useSession } from '../stores/session'

export const liveOpsKeys = {
  all: ['live-ops'] as const,
  snapshot: (connectionId: string | null, generation: number) =>
    [...liveOpsKeys.all, 'snapshot', connectionId, generation] as const,
}

const previousTopByGeneration = new Map<number, TopSample>()

export function useLiveOpsSnapshot(enabled: boolean) {
  const connectionId = useLiveConnection((s) => s.connectionId)
  const generation = useLiveConnection((s) => s.generation)
  const liveStatus = useLiveConnection((s) => s.status)
  const activeTab = useSession((s) => s.activeTab)

  const pollingEnabled =
    enabled && liveStatus === 'connected' && activeTab === 'live-ops' && connectionId != null

  return useQuery({
    queryKey: liveOpsKeys.snapshot(connectionId, generation),
    enabled: pollingEnabled,
    refetchInterval: 1000,
    refetchIntervalInBackground: false,
    staleTime: 0,
    queryFn: async function fetchLiveOpsQuery(): Promise<LiveOpsSnapshot> {
      const snapshotBefore = liveConnectionManager.getSnapshot()
      const generationAtStart = snapshotBefore.generation
      const client = liveConnectionManager.getActiveClient()
      if (client == null || snapshotBefore.status !== 'connected') {
        throw new Error('Not connected')
      }

      const { snapshot, topSample } = await fetchLiveOpsSnapshot(client)

      const snapshotAfter = liveConnectionManager.getSnapshot()
      if (
        snapshotAfter.generation !== generationAtStart ||
        snapshotAfter.status !== 'connected' ||
        liveConnectionManager.getActiveClient() == null
      ) {
        return {
          ops: [],
          ownOpsOnly: false,
          lockNote: '',
          lockWaits: [],
          connections: null,
          queuedOps: null,
          collectionTop: [],
          errors: {
            currentOp: null,
            serverStatus: null,
            top: null,
          },
        }
      }

      let collectionTop = snapshot.collectionTop
      if (topSample != null && snapshot.errors.top == null) {
        const previous = previousTopByGeneration.get(generationAtStart) ?? null
        collectionTop = computeTopDeltas(previous, topSample)
        previousTopByGeneration.set(generationAtStart, topSample)
        // Drop other generations to avoid unbounded growth across reconnects.
        for (const key of previousTopByGeneration.keys()) {
          if (key !== generationAtStart) {
            previousTopByGeneration.delete(key)
          }
        }
      }

      return {
        ...snapshot,
        collectionTop,
      }
    },
  })
}
