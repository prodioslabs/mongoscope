import { useQuery } from '@tanstack/react-query'
import { fetchReplicationSnapshot, type ReplicationSnapshot } from '../../replication'
import { liveConnectionManager } from '../../live-connection'
import { useLiveConnection } from '../stores/live-connection'
import { useSession } from '../stores/session'

export const replicationKeys = {
  all: ['replication'] as const,
  snapshot: (connectionId: string | null, generation: number) =>
    [...replicationKeys.all, 'snapshot', connectionId, generation] as const,
}

const EMPTY_SNAPSHOT: ReplicationSnapshot = {
  topology: null,
  oplog: null,
  errors: {
    topology: null,
    oplog: null,
  },
}

export function useReplicationSnapshot(enabled: boolean) {
  const connectionId = useLiveConnection((s) => s.connectionId)
  const generation = useLiveConnection((s) => s.generation)
  const liveStatus = useLiveConnection((s) => s.status)
  const activeTab = useSession((s) => s.activeTab)

  const pollingEnabled =
    enabled && liveStatus === 'connected' && activeTab === 'replication' && connectionId != null

  return useQuery({
    queryKey: replicationKeys.snapshot(connectionId, generation),
    enabled: pollingEnabled,
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
    staleTime: 0,
    queryFn: async function fetchReplicationQuery(): Promise<ReplicationSnapshot> {
      const snapshotBefore = liveConnectionManager.getSnapshot()
      const generationAtStart = snapshotBefore.generation
      const client = liveConnectionManager.getActiveClient()
      if (client == null || snapshotBefore.status !== 'connected') {
        throw new Error('Not connected')
      }

      const { snapshot } = await fetchReplicationSnapshot(client)

      const snapshotAfter = liveConnectionManager.getSnapshot()
      if (
        snapshotAfter.generation !== generationAtStart ||
        snapshotAfter.status !== 'connected' ||
        liveConnectionManager.getActiveClient() == null
      ) {
        return EMPTY_SNAPSHOT
      }

      return snapshot
    },
  })
}
