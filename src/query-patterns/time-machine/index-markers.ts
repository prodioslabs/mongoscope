import { isRecord } from '../../lib/is-record'
import { SLOW_QUERY_ID } from '../types'
import type { IndexMarker, IndexMarkerKind } from './types'

/** MongoDB log message ids used for index timeline markers. */
export const INDEX_BUILD_START_ID = 20384
export const INDEX_BUILD_COMPLETE_ID = 20663
export const DROP_INDEXES_CMD_ID = 51806

type HotRow = {
  row: number
  id: number
  timestampMs: number
  msg: string
}

/**
 * Classify a log row + parsed attr into an index marker, or null.
 * Callers supply attr only for candidate ids (avoid full-file reparse).
 */
export function indexMarkerFromAttr(row: HotRow, attr: unknown): IndexMarker | null {
  if (!Number.isFinite(row.timestampMs)) {
    return null
  }

  if (row.id === INDEX_BUILD_START_ID || row.msg === 'Index build: starting') {
    return markerFromBuildAttr(row.timestampMs, 'index-build-start', attr)
  }

  if (row.id === INDEX_BUILD_COMPLETE_ID || row.msg === 'Index build: completed successfully') {
    return markerFromBuildAttr(row.timestampMs, 'index-build-complete', attr)
  }

  if (row.id === DROP_INDEXES_CMD_ID || row.msg === 'CMD: dropIndexes') {
    return markerFromDropAttr(row.timestampMs, attr)
  }

  if (row.id === SLOW_QUERY_ID) {
    return markerFromSlowCreateIndexes(row.timestampMs, attr)
  }

  return null
}

export function isIndexMarkerCandidateId(id: number): boolean {
  return (
    id === INDEX_BUILD_START_ID ||
    id === INDEX_BUILD_COMPLETE_ID ||
    id === DROP_INDEXES_CMD_ID ||
    id === SLOW_QUERY_ID
  )
}

/** Keep markers for the same `db.collection` namespace as the pattern. */
export function filterMarkersForNamespace(
  markers: readonly IndexMarker[],
  namespace: string,
): IndexMarker[] {
  const ns = namespace.trim()
  if (ns === '') {
    return []
  }
  return markers.filter(function matchesNamespace(marker) {
    return marker.namespace === ns
  })
}

function markerFromBuildAttr(
  timestampMs: number,
  kind: IndexMarkerKind,
  attr: unknown,
): IndexMarker | null {
  if (!isRecord(attr)) {
    return null
  }
  const namespace = typeof attr.namespace === 'string' ? attr.namespace : ''
  if (namespace === '') {
    return null
  }

  let label = ''
  if (kind === 'index-build-complete' && Array.isArray(attr.indexesBuilt)) {
    label = attr.indexesBuilt
      .filter((name): name is string => typeof name === 'string' && name.trim() !== '')
      .join(', ')
  }
  if (label === '' && isRecord(attr.properties) && typeof attr.properties.name === 'string') {
    label = attr.properties.name
  }
  if (label === '' && isRecord(attr.firstIndex) && typeof attr.firstIndex.name === 'string') {
    label = attr.firstIndex.name
  }
  if (label === '' && typeof attr.index === 'string') {
    label = attr.index
  }
  if (label === '') {
    label = kind === 'index-build-start' ? 'index build' : 'index build done'
  }

  return { timestampMs, kind, namespace, label }
}

function markerFromDropAttr(timestampMs: number, attr: unknown): IndexMarker | null {
  if (!isRecord(attr)) {
    return null
  }
  const namespace = typeof attr.namespace === 'string' ? attr.namespace : ''
  if (namespace === '') {
    return null
  }
  let label = 'dropIndexes'
  if (typeof attr.indexes === 'string' && attr.indexes.trim() !== '') {
    label = attr.indexes
  } else if (Array.isArray(attr.indexes)) {
    label = attr.indexes
      .filter((name): name is string => typeof name === 'string' && name.trim() !== '')
      .join(', ')
  }
  return { timestampMs, kind: 'drop-indexes', namespace, label }
}

function markerFromSlowCreateIndexes(timestampMs: number, attr: unknown): IndexMarker | null {
  if (!isRecord(attr)) {
    return null
  }
  const command = isRecord(attr.command) ? attr.command : null
  if (command == null || !('createIndexes' in command)) {
    return null
  }

  const ns =
    typeof attr.ns === 'string' && attr.ns.trim() !== ''
      ? attr.ns
      : typeof command.createIndexes === 'string'
        ? String(command.$db ?? '') !== ''
          ? `${command.$db}.${command.createIndexes}`
          : String(command.createIndexes)
        : ''
  if (ns === '') {
    return null
  }

  let label = 'createIndexes'
  if (Array.isArray(command.indexes)) {
    const names: string[] = []
    for (const index of command.indexes) {
      if (isRecord(index) && typeof index.name === 'string' && index.name.trim() !== '') {
        names.push(index.name)
      }
    }
    if (names.length > 0) {
      label = names.join(', ')
    }
  }

  return { timestampMs, kind: 'create-indexes', namespace: ns, label }
}
