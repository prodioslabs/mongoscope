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
  indexes(): Promise<unknown[]>
  aggregate(pipeline: Record<string, unknown>[]): AggregateCursorLike
}

export type MongoDbLike = {
  admin(): {
    command(command: Record<string, unknown>): Promise<unknown>
  }
  command(command: Record<string, unknown>): Promise<unknown>
  aggregate(pipeline: Record<string, unknown>[]): AggregateCursorLike
  collection(name: string): CollectionLike
}

export type MongoClientLike = {
  connect(): Promise<void>
  close(force?: boolean): Promise<void>
  db(dbName?: string): MongoDbLike
  on?(event: 'close', listener: () => void): void
  off?(event: 'close', listener: () => void): void
  removeListener?(event: 'close', listener: () => void): void
}

/** Client seam that can open databases (`db()`). Shared by feature fetchers. */
export type MongoDbClient = Pick<MongoClientLike, 'db'>

export type CreateMongoClient = (uri: string, options: MongoClientOptions) => MongoClientLike

export function defaultCreateMongoClient(
  uri: string,
  options: MongoClientOptions,
): MongoClientLike {
  const client = new MongoClient(uri, options)
  return {
    connect: async () => {
      await client.connect()
    },
    close: (force) => client.close(force),
    db: (dbName) => client.db(dbName) as MongoDbLike,
    on: (event, listener) => {
      client.on(event, listener)
    },
    off: (event, listener) => {
      client.off(event, listener)
    },
    removeListener: (event, listener) => {
      client.removeListener(event, listener)
    },
  }
}

export function buildConnectOptions(connectTimeoutMs: number): MongoClientOptions {
  return {
    serverSelectionTimeoutMS: connectTimeoutMs,
    connectTimeoutMS: connectTimeoutMs,
  }
}
