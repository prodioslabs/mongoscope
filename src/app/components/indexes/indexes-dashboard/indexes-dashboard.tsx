import { bold, fg, type TextChunk, type TextTableContent, TextAttributes } from '@opentui/core'
import { useBindings } from '@opentui/keymap/react'
import { useRenderer, useTerminalDimensions } from '@opentui/react'
import { useEffect, useRef, useState } from 'react'
import {
  formatBytes,
  formatBuildProgress,
  formatIndexFlags,
  formatOps,
  formatSince,
  truncateIndexCell,
  type CollectionIndexes,
  type IndexesSnapshot,
  type IndexRow,
} from '../../../../indexes'
import { displayText } from '../../../../lib/display-text'
import {
  computeTableCapacity,
  headerCell,
  padTableRows,
  tableCell,
} from '../../../lib/text-table-content'
import { type AppKeymapMode } from '../../../lib/keymap-mode'
import { whenNotEditing } from '../../../lib/when-not-editing'
import { INDEXES_FOOTER, INDEXES_SHORTCUTS, toBindings } from '../../../shortcuts'
import { useSession } from '../../../stores/session'
import { useTheme } from '../../../stores/theme'
import { type Theme } from '../../../theme'
import { DataTextTable } from '../../data-text-table'
import { useFooterKeybindings } from '../../footer-keybindings'

type IndexesDashboardProps = {
  snapshot: IndexesSnapshot | undefined
  isPending: boolean
}

type CollectionSortBy = 'name' | 'indexes'
type IndexSortBy = 'size' | 'ops'
type SortDirection = 'asc' | 'desc'

const COLLECTION_LIST_WIDTH = 36
const EMPTY_DATABASES: string[] = []
const EMPTY_COLLECTIONS: CollectionIndexes[] = []
const EMPTY_ERRORS: IndexesSnapshot['errors'] = {
  databases: null,
  collections: null,
  builds: null,
}

/** Tab bar, footer, DbSelector, title, DB chips, notes, table chrome. */
const INDEXES_CHROME_ROWS = 16

export function IndexesDashboard({ snapshot, isPending }: IndexesDashboardProps) {
  const theme = useTheme((s) => s.theme)
  const renderer = useRenderer()
  const notEditing = whenNotEditing(renderer)
  const { height: terminalHeight } = useTerminalDimensions()
  const selectedDatabase = useSession((s) => s.selectedDatabase)
  const setSelectedDatabase = useSession((s) => s.setSelectedDatabase)

  const databases = snapshot?.databases ?? EMPTY_DATABASES
  const collections = snapshot?.collections ?? EMPTY_COLLECTIONS
  const errors = snapshot?.errors ?? EMPTY_ERRORS

  const [collectionSortBy, setCollectionSortBy] = useState<CollectionSortBy>('name')
  const [collectionSortDirection, setCollectionSortDirection] = useState<SortDirection>('asc')
  const [indexSortBy, setIndexSortBy] = useState<IndexSortBy>('size')
  const [indexSortDirection, setIndexSortDirection] = useState<SortDirection>('desc')
  const [selectedCollectionName, setSelectedCollectionName] = useState<string | null>(null)
  const [collectionScrollOffset, setCollectionScrollOffset] = useState(0)
  const [selectedIndexName, setSelectedIndexName] = useState<string | null>(null)
  const [indexScrollOffset, setIndexScrollOffset] = useState(0)

  const capacity = computeTableCapacity(INDEXES_CHROME_ROWS, terminalHeight)
  const sortedCollections = sortCollections(collections, collectionSortBy, collectionSortDirection)

  const selectedCollectionIndex =
    selectedCollectionName == null
      ? -1
      : sortedCollections.findIndex((collection) => collection.name === selectedCollectionName)
  const focusedCollection: CollectionIndexes | null =
    selectedCollectionIndex >= 0
      ? (sortedCollections[selectedCollectionIndex] ?? null)
      : (sortedCollections[0] ?? null)
  const indexRows = sortIndexRows(
    focusedCollection?.indexes ?? [],
    indexSortBy,
    indexSortDirection,
  )

  const databasesRef = useRef(databases)
  const sortedCollectionsRef = useRef(sortedCollections)
  const indexRowsRef = useRef(indexRows)
  const selectedDatabaseRef = useRef(selectedDatabase)
  const selectedCollectionNameRef = useRef(selectedCollectionName)
  const selectedIndexNameRef = useRef(selectedIndexName)
  const collectionScrollOffsetRef = useRef(collectionScrollOffset)
  const indexScrollOffsetRef = useRef(indexScrollOffset)
  const capacityRef = useRef(capacity)
  const collectionSortByRef = useRef(collectionSortBy)
  const collectionSortDirectionRef = useRef(collectionSortDirection)
  const indexSortByRef = useRef(indexSortBy)
  const indexSortDirectionRef = useRef(indexSortDirection)

  databasesRef.current = databases
  sortedCollectionsRef.current = sortedCollections
  indexRowsRef.current = indexRows
  selectedDatabaseRef.current = selectedDatabase
  selectedCollectionNameRef.current = selectedCollectionName
  selectedIndexNameRef.current = selectedIndexName
  collectionScrollOffsetRef.current = collectionScrollOffset
  indexScrollOffsetRef.current = indexScrollOffset
  capacityRef.current = capacity
  collectionSortByRef.current = collectionSortBy
  collectionSortDirectionRef.current = collectionSortDirection
  indexSortByRef.current = indexSortBy
  indexSortDirectionRef.current = indexSortDirection

  useEffect(
    function autoSelectDatabaseWhenNeeded() {
      // Avoid treating a missing/pending query result as an empty DB list — that
      // clears selection, changes the query key, and loops forever.
      if (snapshot == null) {
        return
      }

      const nextDatabases = snapshot.databases
      if (nextDatabases.length === 0) {
        if (selectedDatabase != null) {
          setSelectedDatabase(null)
        }
        return
      }

      if (selectedDatabase == null || !nextDatabases.includes(selectedDatabase)) {
        const nextDatabase = nextDatabases[0] ?? null
        if (nextDatabase !== selectedDatabase) {
          setSelectedDatabase(nextDatabase)
        }
      }
    },
    [snapshot, selectedDatabase, setSelectedDatabase],
  )

  useEffect(
    function reconcileCollectionSelection() {
      if (collections.length === 0) {
        setSelectedCollectionName(null)
        setCollectionScrollOffset(0)
        return
      }

      setSelectedCollectionName((current) => {
        if (current != null && collections.some((collection) => collection.name === current)) {
          return current
        }
        const sorted = sortCollections(collections, collectionSortBy, collectionSortDirection)
        return sorted[0]?.name ?? null
      })
    },
    [collections, collectionSortBy, collectionSortDirection],
  )

  useEffect(
    function clampCollectionScrollOffset() {
      setCollectionScrollOffset((offset) => {
        if (sortedCollections.length === 0) {
          return 0
        }
        const maxOffset = Math.max(0, sortedCollections.length - capacity)
        return Math.min(offset, maxOffset)
      })
    },
    [capacity, sortedCollections.length],
  )

  useEffect(
    function reconcileIndexSelection() {
      if (indexRows.length === 0) {
        setSelectedIndexName(null)
        setIndexScrollOffset(0)
        return
      }

      setSelectedIndexName((current) => {
        if (current != null && indexRows.some((row) => row.name === current)) {
          return current
        }
        return indexRows[0]?.name ?? null
      })
      setIndexScrollOffset(0)
    },
    [focusedCollection?.name, indexRows.length],
  )

  useEffect(
    function clampIndexScrollOffset() {
      setIndexScrollOffset((offset) => {
        if (indexRows.length === 0) {
          return 0
        }
        const maxOffset = Math.max(0, indexRows.length - capacity)
        return Math.min(offset, maxOffset)
      })
    },
    [capacity, indexRows.length],
  )

  useFooterKeybindings(INDEXES_FOOTER)

  useBindings(
    function createIndexesNavigationLayer() {
      function cycleDatabase(delta: number) {
        const list = databasesRef.current
        if (list.length === 0) {
          return
        }
        const current = selectedDatabaseRef.current
        const currentIndex = current == null ? 0 : Math.max(0, list.indexOf(current))
        const nextIndex = (currentIndex + delta + list.length) % list.length
        setSelectedDatabase(list[nextIndex] ?? null)
        setSelectedCollectionName(null)
        setSelectedIndexName(null)
        setCollectionScrollOffset(0)
        setIndexScrollOffset(0)
      }

      function moveCollection(delta: number) {
        const list = sortedCollectionsRef.current
        const length = list.length
        if (length === 0) {
          return
        }

        let prev = list.findIndex((collection) => collection.name === selectedCollectionNameRef.current)
        if (prev < 0) {
          prev = delta > 0 ? -1 : length
        }

        const next = Math.max(0, Math.min(length - 1, prev + delta))
        const nextCollection = list[next]
        if (nextCollection == null) {
          return
        }

        setSelectedCollectionName(nextCollection.name)

        const cap = capacityRef.current
        const offset = collectionScrollOffsetRef.current
        if (next < offset) {
          setCollectionScrollOffset(next)
        } else if (next >= offset + cap) {
          setCollectionScrollOffset(next - cap + 1)
        }
      }

      function moveIndexSelection(delta: number) {
        const currentRows = indexRowsRef.current
        const length = currentRows.length
        if (length === 0) {
          return
        }

        let prev = currentRows.findIndex((row) => row.name === selectedIndexNameRef.current)
        if (prev < 0) {
          prev = delta > 0 ? -1 : length
        }

        const next = Math.max(0, Math.min(length - 1, prev + delta))
        const nextRow = currentRows[next]
        if (nextRow == null) {
          return
        }

        setSelectedIndexName(nextRow.name)

        const cap = capacityRef.current
        const offset = indexScrollOffsetRef.current
        if (next < offset) {
          setIndexScrollOffset(next)
        } else if (next >= offset + cap) {
          setIndexScrollOffset(next - cap + 1)
        }
      }

      function applyCollectionSort(next: CollectionSortBy) {
        if (sortedCollectionsRef.current.length === 0) {
          return
        }
        if (collectionSortByRef.current === next) {
          setCollectionSortDirection((direction) => (direction === 'desc' ? 'asc' : 'desc'))
        } else {
          setCollectionSortBy(next)
          setCollectionSortDirection(next === 'name' ? 'asc' : 'desc')
        }
        setCollectionScrollOffset(0)
      }

      function applyIndexSort(next: IndexSortBy) {
        if (indexRowsRef.current.length === 0) {
          return
        }
        if (indexSortByRef.current === next) {
          setIndexSortDirection((direction) => (direction === 'desc' ? 'asc' : 'desc'))
        } else {
          setIndexSortBy(next)
          setIndexSortDirection('desc')
        }
        setIndexScrollOffset(0)
      }

      return {
        appMode: 'base' satisfies AppKeymapMode,
        enabled: function indexesNavigationEnabled() {
          return notEditing()
        },
        commands: [
          {
            name: 'indexes.prev-database',
            run() {
              cycleDatabase(-1)
            },
          },
          {
            name: 'indexes.next-database',
            run() {
              cycleDatabase(1)
            },
          },
          {
            name: 'indexes.prev-collection',
            run() {
              moveCollection(-1)
            },
          },
          {
            name: 'indexes.next-collection',
            run() {
              moveCollection(1)
            },
          },
          {
            name: 'indexes.move-up',
            run() {
              moveIndexSelection(-1)
            },
          },
          {
            name: 'indexes.move-down',
            run() {
              moveIndexSelection(1)
            },
          },
          {
            name: 'indexes.sort-collection-name',
            run() {
              applyCollectionSort('name')
            },
          },
          {
            name: 'indexes.sort-collection-indexes',
            run() {
              applyCollectionSort('indexes')
            },
          },
          {
            name: 'indexes.sort-size',
            run() {
              applyIndexSort('size')
            },
          },
          {
            name: 'indexes.sort-ops',
            run() {
              applyIndexSort('ops')
            },
          },
        ],
        bindings: toBindings(INDEXES_SHORTCUTS),
      }
    },
    [notEditing, setSelectedDatabase],
  )

  const visibleCollections = sortedCollections.slice(
    collectionScrollOffset,
    collectionScrollOffset + capacity,
  )
  const relativeCollectionSelectedIndex =
    selectedCollectionIndex >= collectionScrollOffset &&
    selectedCollectionIndex < collectionScrollOffset + capacity
      ? selectedCollectionIndex - collectionScrollOffset
      : -1

  const resolvedIndex =
    selectedIndexName == null
      ? -1
      : indexRows.findIndex((row) => row.name === selectedIndexName)
  const visibleIndexes = indexRows.slice(indexScrollOffset, indexScrollOffset + capacity)
  const relativeSelectedIndex =
    resolvedIndex >= indexScrollOffset && resolvedIndex < indexScrollOffset + capacity
      ? resolvedIndex - indexScrollOffset
      : -1

  const collectionsTableContent = buildCollectionsTableContent(
    visibleCollections,
    relativeCollectionSelectedIndex,
    theme,
    capacity,
    collectionSortBy,
    collectionSortDirection,
  )
  const indexesTableContent = buildIndexesTableContent(
    visibleIndexes,
    relativeSelectedIndex,
    theme,
    capacity,
    indexSortBy,
    indexSortDirection,
  )

  return (
    <box flexGrow={1} flexShrink={1} flexDirection="column" paddingLeft={1} paddingRight={1} gap={1}>
      <box flexDirection="row" justifyContent="space-between" flexShrink={0}>
        <text
          content="indexes — inventory & usage"
          fg={theme.text}
          attributes={TextAttributes.BOLD}
        />
        <text
          content={displayText(isPending && snapshot == null ? 'refresh: …' : 'refresh: 5s')}
          fg={theme.textMuted}
        />
      </box>

      {errors.databases != null ? (
        <text content={displayText(errors.databases.message)} fg={theme.error} />
      ) : null}

      <box flexDirection="row" flexWrap="wrap" gap={1} flexShrink={0}>
        <text content="DB" fg={theme.textMuted} flexShrink={0} />
        {databases.length === 0 ? (
          <text content="(none)" fg={theme.textMuted} />
        ) : (
          databases.map(function renderDatabaseChip(name) {
            const selected = name === selectedDatabase
            return (
              <text
                key={name}
                content={displayText(selected ? `[${name}]` : name)}
                fg={selected ? theme.primary : theme.textMuted}
                {...(selected ? { attributes: TextAttributes.BOLD } : {})}
              />
            )
          })
        )}
      </box>

      {errors.collections != null ? (
        <text content={displayText(errors.collections.message)} fg={theme.error} />
      ) : null}

      {selectedDatabase == null ? (
        <text content="Select a database to inspect indexes." fg={theme.textMuted} />
      ) : (
        <box flexGrow={1} flexShrink={1} flexDirection="row" gap={1}>
          <box width={COLLECTION_LIST_WIDTH} flexShrink={0} flexDirection="column" gap={0}>
            <DataTextTable content={collectionsTableContent} theme={theme} />
            {sortedCollections.length === 0 ? (
              <box flexShrink={0}>
                <text
                  content={displayText(isPending ? 'Loading…' : 'no collections')}
                  fg={theme.textMuted}
                />
              </box>
            ) : null}
          </box>

          <box flexGrow={1} flexShrink={1} flexDirection="column" gap={0}>
            <IndexTableHeader collection={focusedCollection} />
            {errors.builds != null ? (
              <text content={displayText(errors.builds.message)} fg={theme.warning} />
            ) : null}
            {focusedCollection?.error != null ? (
              <text content={displayText(focusedCollection.error.message)} fg={theme.error} />
            ) : null}
            {focusedCollection?.usageUnavailable ? (
              <text
                content="usage n/a (needs indexStats / clusterMonitor)"
                fg={theme.textMuted}
              />
            ) : null}
            <DataTextTable content={indexesTableContent} theme={theme} />
            {focusedCollection != null &&
            focusedCollection.error == null &&
            indexRows.length === 0 ? (
              <box flexShrink={0}>
                <text
                  content={displayText(isPending ? 'Loading indexes…' : 'no indexes')}
                  fg={theme.textMuted}
                />
              </box>
            ) : null}
          </box>
        </box>
      )}
    </box>
  )
}

type IndexTableHeaderProps = {
  collection: CollectionIndexes | null
}

function IndexTableHeader({ collection }: IndexTableHeaderProps) {
  const theme = useTheme((s) => s.theme)

  if (collection == null) {
    return <text content="Select a collection" fg={theme.textMuted} />
  }

  return (
    <box flexDirection="row" justifyContent="space-between" flexShrink={0}>
      <text
        content={displayText(collection.name)}
        fg={theme.text}
        attributes={TextAttributes.BOLD}
      />
      <text
        content={displayText(
          collection.totalIndexSizeBytes == null
            ? ''
            : `total ${formatBytes(collection.totalIndexSizeBytes)}`,
        )}
        fg={theme.textMuted}
      />
    </box>
  )
}

function sortCollections(
  collections: CollectionIndexes[],
  sortBy: CollectionSortBy,
  sortDirection: SortDirection,
): CollectionIndexes[] {
  const copy = collections.slice()
  const ascending = sortDirection === 'asc'
  copy.sort(function compareCollections(a, b) {
    if (sortBy === 'indexes') {
      const delta = a.indexes.length - b.indexes.length
      if (delta !== 0) {
        return ascending ? delta : -delta
      }
    }

    const nameDelta = a.name.localeCompare(b.name)
    return ascending ? nameDelta : -nameDelta
  })
  return copy
}

function sortIndexRows(
  rows: IndexRow[],
  sortBy: IndexSortBy,
  sortDirection: SortDirection,
): IndexRow[] {
  const copy = rows.slice()
  const ascending = sortDirection === 'asc'
  copy.sort(function compareIndexRows(a, b) {
    const left = sortBy === 'size' ? (a.sizeBytes ?? -1) : (a.ops ?? -1)
    const right = sortBy === 'size' ? (b.sizeBytes ?? -1) : (b.ops ?? -1)
    const delta = left - right
    if (delta !== 0) {
      return ascending ? delta : -delta
    }
    return a.name.localeCompare(b.name)
  })
  return copy
}

function sortArrow(sortDirection: SortDirection): string {
  return sortDirection === 'desc' ? '▼' : '▲'
}

/**
 * Active sort headers keep the label muted and paint only the arrow in the
 * selection/primary color so the sort indicator reads clearly.
 */
function sortableHeaderCell(
  base: string,
  theme: Theme,
  active: boolean,
  sortDirection: SortDirection,
): TextChunk[] {
  if (!active) {
    return [bold(fg(theme.textMuted)(base))]
  }
  return [
    bold(fg(theme.textMuted)(base)),
    bold(fg(theme.primary)(` ${sortArrow(sortDirection)}`)),
  ]
}

function buildCollectionsTableContent(
  collections: CollectionIndexes[],
  selectedIndex: number,
  theme: Theme,
  rowCapacity: number,
  sortBy: CollectionSortBy,
  sortDirection: SortDirection,
): TextTableContent {
  const header: TextChunk[][] = [
    sortableHeaderCell('COLLECTION', theme, sortBy === 'name', sortDirection),
    sortableHeaderCell('IDX', theme, sortBy === 'indexes', sortDirection),
  ]

  const tableRows: TextTableContent = [header]

  for (let i = 0; i < collections.length; i++) {
    const collection = collections[i]!
    const selected = i === selectedIndex
    const nameLabel = truncateIndexCell(collection.name, 22)
    tableRows.push([
      selected
        ? tableCell(`${nameLabel} ●`, theme.primary)
        : tableCell(nameLabel, theme.text),
      tableCell(String(collection.indexes.length), theme.textMuted),
    ])
  }

  return padTableRows(tableRows, rowCapacity)
}

function buildIndexesTableContent(
  rows: IndexRow[],
  selectedIndex: number,
  theme: Theme,
  rowCapacity: number,
  sortBy: IndexSortBy,
  sortDirection: SortDirection,
): TextTableContent {
  const header: TextChunk[][] = [
    headerCell('INDEX', theme),
    headerCell('KEYS', theme),
    headerCell('OPTS', theme),
    headerCell('BUILD', theme),
    sortableHeaderCell('SIZE', theme, sortBy === 'size', sortDirection),
    sortableHeaderCell('OPS', theme, sortBy === 'ops', sortDirection),
    headerCell('SINCE', theme),
  ]

  const tableRows: TextTableContent = [header]

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!
    const selected = i === selectedIndex
    tableRows.push(buildIndexTableRow(row, selected, theme))
  }

  return padTableRows(tableRows, rowCapacity)
}

function buildIndexTableRow(row: IndexRow, selected: boolean, theme: Theme): TextChunk[][] {
  const nameLabel = truncateIndexCell(row.name, 22)
  const nameCell = selected
    ? tableCell(`${nameLabel} ●`, theme.primary)
    : tableCell(nameLabel, theme.text)
  const buildLabel = formatBuildProgress({
    building: row.building,
    buildPercent: row.buildPercent,
  })
  const buildColor = row.building ? theme.warning : theme.textMuted

  return [
    nameCell,
    tableCell(truncateIndexCell(row.keyLabel, 28), theme.text),
    tableCell(truncateIndexCell(formatIndexFlags(row.flags), 16), theme.textMuted),
    tableCell(buildLabel, buildColor),
    tableCell(formatBytes(row.sizeBytes), theme.textMuted),
    tableCell(formatOps(row.ops), theme.textMuted),
    tableCell(formatSince(row.since), theme.textMuted),
  ]
}
