export {
  buildConnectOptions,
  DEFAULT_CONNECT_TIMEOUT_MS,
  defaultCreateMongoClient,
  type CreateMongoClient,
  type MongoClientLike,
} from './client-factory'
export {
  LiveConnectionError,
  mapConnectFailure,
  type LiveConnectionErrorCode,
} from './errors'
export { formatLiveConnectionError } from './format-live-connection-error'
export {
  createLiveConnectionManager,
  liveConnectionManager,
  type LiveConnectionManager,
  type LiveConnectionManagerDeps,
} from './manager'
export { redactConnectionSecrets } from './redact'
export {
  IDLE_LIVE_CONNECTION_SNAPSHOT,
  type LiveConnectionDisconnectReason,
  type LiveConnectionSnapshot,
  type LiveConnectionStatus,
} from './types'
