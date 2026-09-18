import { useEffect } from 'react'
import { connectionStore, formatConnectionError } from '../../connections'
import { LiveConnectionError, liveConnectionManager } from '../../live-connection'
import { useSession } from '../stores/session'

/**
 * Keeps the live MongoDB client in sync with the session's active connection selection.
 * Mount once at the app root.
 */
export function useSyncLiveConnection(): void {
  const activeConnectionId = useSession((s) => s.activeConnectionId)

  useEffect(
    function syncLiveConnectionToActiveSelection() {
      let cancelled = false

      async function applyActiveConnection() {
        if (activeConnectionId == null) {
          await liveConnectionManager.disconnect('user')
          return
        }

        let uri: string | null
        try {
          uri = await connectionStore.getUri(activeConnectionId)
        } catch (error) {
          if (cancelled) {
            return
          }
          await liveConnectionManager.fail(
            activeConnectionId,
            new LiveConnectionError('missing_uri', formatConnectionError(error)),
          )
          return
        }

        if (cancelled) {
          return
        }

        if (uri == null) {
          await liveConnectionManager.fail(
            activeConnectionId,
            new LiveConnectionError('missing_uri', 'Connection profile not found or has no URI.'),
          )
          return
        }

        await liveConnectionManager.connect(activeConnectionId, uri)
      }

      void applyActiveConnection()

      return function cancelStaleSync() {
        cancelled = true
      }
    },
    [activeConnectionId],
  )
}
