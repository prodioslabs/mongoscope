export { hostLabelFromUri } from '../lib/mongodb-uri'
export { formatConnectionError } from './format-connection-error'
export {
  CONNECTIONS_SECRET_NAME,
  createSecretStore,
  defaultSecretStore,
  SECRET_SERVICE,
  SecretStoreError,
  type SecretBackend,
  type SecretStore,
  type SecretStoreCode,
} from './secret-store'
export {
  add,
  connectionStore,
  createConnectionStore,
  list,
  remove,
  update,
  type AddConnectionInput,
  type ConnectionStore,
  type ConnectionStoreDeps,
  type UpdateConnectionInput,
} from './store'
export type { ConnectionProfile, ConnectionsBlob, StoredConnection } from './types'
export { emptyConnectionsBlob, toConnectionProfile, validateConnectionsBlob } from './validate'
