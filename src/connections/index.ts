export { hostLabelFromUri } from '../lib/mongodb-uri'
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
  type AddConnectionInput,
  type ConnectionStore,
  type ConnectionStoreDeps,
} from './store'
export type { ConnectionProfile, ConnectionsBlob, StoredConnection } from './types'
export { emptyConnectionsBlob, toConnectionProfile, validateConnectionsBlob } from './validate'
