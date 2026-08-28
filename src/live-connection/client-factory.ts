import { MongoClient, type MongoClientOptions } from 'mongodb'

export const DEFAULT_CONNECT_TIMEOUT_MS = 8000

/**
 * Thin seam over the official driver. Prefer mongodb@6.x on Bun:
 * mongodb@7 pulls a bson build that hits Bun's unimplemented
 * `v8.isBuildingSnapshot` at import time (Bun 1.3.x).
 */
export type MongoClientLike = {
  connect(): Promise<unknown>
  close(force?: boolean): Promise<void>
  db(dbName?: string): {
    admin(): {
      command(command: Record<string, unknown>): Promise<unknown>
    }
  }
  on?(event: 'close', listener: () => void): unknown
  off?(event: 'close', listener: () => void): unknown
  removeListener?(event: 'close', listener: () => void): unknown
}

export type CreateMongoClient = (uri: string, options: MongoClientOptions) => MongoClientLike

export function defaultCreateMongoClient(uri: string, options: MongoClientOptions): MongoClientLike {
  return new MongoClient(uri, options)
}

export function buildConnectOptions(connectTimeoutMs: number): MongoClientOptions {
  return {
    serverSelectionTimeoutMS: connectTimeoutMs,
    connectTimeoutMS: connectTimeoutMs,
  }
}
