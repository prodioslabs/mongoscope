import { create } from 'zustand'
import {
  liveConnectionManager,
  type LiveConnectionSnapshot,
} from '../../live-connection'

type LiveConnectionStore = LiveConnectionSnapshot & {
  retry: () => Promise<void>
}

export const useLiveConnection = create<LiveConnectionStore>(() => ({
  ...liveConnectionManager.getSnapshot(),
  async retry() {
    await liveConnectionManager.retry()
  },
}))

liveConnectionManager.subscribe(function syncLiveConnectionSnapshot(snapshot) {
  useLiveConnection.setState({
    status: snapshot.status,
    connectionId: snapshot.connectionId,
    errorMessage: snapshot.errorMessage,
    generation: snapshot.generation,
  })
})
