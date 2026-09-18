import { MongoClient, type MongoClientOptions } from 'mongodb'

export const DEFAULT_CONNECT_TIMEOUT_MS = 8000

/**
 * Thin seam over the official driver. Prefer mongodb@6.x on Bun:
 * mongodb@7 pulls a bson build that hits Bun's unimplemented
 * `v8.isBuildingSnapshot` at import time (Bun 1.3.x).
 */
export type AggregateCursorLike = {
  toArray(): Promise<unknown[]>
}

export type FindCursorLike = {
  sort(sort: Record<string, unknown>): FindCursorLike
  limit(n: number): FindCursorLike
  toArray(): Promise<unknown[]>
}

export type CollectionLike = {
  find(filter?: Record<string, unknown>): FindCursorLike
}

export type MongoDbLike = {
  admin(): {
    command(command: Record<string, unknown>): Promise<unknown>
  }
  /** Database-scoped command (e.g. `{ collStats: 'oplog.rs' }` on `local`). */
  command(command: Record<string, unknown>): Promise<unknown>
  aggregate(pipeline: Record<string, unknown>[]): AggregateCursorLike
  collection(name: string): CollectionLike
}

export type MongoClientLike = {
  connect(): Promise<unknown>
  close(force?: boolean): Promise<void>
  db(dbName?: string): MongoDbLike
  on?(event: 'close', listener: () => void): unknown
  off?(event: 'close', listener: () => void): unknown
  removeListener?(event: 'close', listener: () => void): unknown
}

export type CreateMongoClient = (uri: string, options: MongoClientOptions) => MongoClientLike

export function defaultCreateMongoClient(uri: string, options: MongoClientOptions): MongoClientLike {
  // Driver Db/Collection APIs are wider than our seam; cast at the boundary.
  return new MongoClient(uri, options) as unknown as MongoClientLike
}

export function buildConnectOptions(connectTimeoutMs: number): MongoClientOptions {
  return {
    serverSelectionTimeoutMS: connectTimeoutMs,
    connectTimeoutMS: connectTimeoutMs,
  }
}
