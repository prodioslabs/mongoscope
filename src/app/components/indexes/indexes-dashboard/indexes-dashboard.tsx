import { TextAttributes } from '@opentui/core'
import { useBindings } from '@opentui/keymap/react'
import { useRenderer } from '@opentui/react'
import { useEffect, useRef, useState } from 'react'
import {
  formatBytes,
  formatIndexFlags,
  formatOps,
  formatSince,
  type CollectionIndexes,
  type IndexesSnapshot,
  type IndexRow,
} from '../../../../indexes'
import { displayText } from '../../../../lib/display-text'
import { type AppKeymapMode } from '../../../lib/keymap-mode'
import { whenNotEditing } from '../../../lib/when-not-editing'
import { INDEXES_FOOTER, INDEXES_SHORTCUTS, toBindings } from '../../../shortcuts'
import { useSession } from '../../../stores/session'
import { useTheme } from '../../../stores/theme'
import { selectedForeground } from '../../../theme'
import { useFooterKeybindings } from '../../footer-keybindings'

type IndexesDashboardProps = {
  snapshot: IndexesSnapshot | undefined
  isPending: boolean
}

const COLLECTION_LIST_WIDTH = 28
const EMPTY_DATABASES: string[] = []
const EMPTY_COLLECTIONS: CollectionIndexes[] = []
const EMPTY_ERRORS: IndexesSnapshot['errors'] = { databases: null, collections: null }

export function IndexesDashboard({ snapshot, isPending }: IndexesDashboardProps) {
  const theme = useTheme((s) => s.theme)
  const renderer = useRenderer()
  const notEditing = whenNotEditing(renderer)
  const selectedDatabase = useSession((s) => s.selectedDatabase)
  const setSelectedDatabase = useSession((s) => s.setSelectedDatabase)

  const databases = snapshot?.databases ?? EMPTY_DATABASES
  const collections = snapshot?.collections ?? EMPTY_COLLECTIONS
  const errors = snapshot?.errors ?? EMPTY_ERRORS

  const [selectedCollectionIndex, setSelectedCollectionIndex] = useState(0)

  const databasesRef = useRef(databases)
  const collectionsRef = useRef(collections)
  const selectedDatabaseRef = useRef(selectedDatabase)
  const selectedCollectionIndexRef = useRef(selectedCollectionIndex)

  databasesRef.current = databases
  collectionsRef.current = collections
  selectedDatabaseRef.current = selectedDatabase
  selectedCollectionIndexRef.current = selectedCollectionIndex

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
    function clampSelectedCollectionIndex() {
      const length = collections.length
      setSelectedCollectionIndex((index) => {
        if (length === 0) {
          return 0
        }
        const nextIndex = Math.min(index, length - 1)
        return nextIndex === index ? index : nextIndex
      })
    },
    [collections.length],
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
        setSelectedCollectionIndex(0)
      }

      function moveCollection(delta: number) {
        const length = collectionsRef.current.length
        if (length === 0) {
          return
        }
        setSelectedCollectionIndex((index) => {
          return (index + delta + length) % length
        })
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
        ],
        bindings: toBindings(INDEXES_SHORTCUTS),
      }
    },
    [notEditing, setSelectedDatabase],
  )

  const highlightFg = selectedForeground(theme)
  const focusedCollection: CollectionIndexes | null =
    collections[selectedCollectionIndex] ?? null

  return (
    <box flexGrow={1} flexShrink={1} flexDirection="column" paddingLeft={1} paddingRight={1} gap={1}>
      <box flexDirection="row" justifyContent="space-between" flexShrink={0}>
        <text content="Indexes" fg={theme.text} attributes={TextAttributes.BOLD} />
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
                fg={selected ? theme.accent : theme.textMuted}
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
          <box
            width={COLLECTION_LIST_WIDTH}
            flexShrink={0}
            flexDirection="column"
            border
            borderStyle="single"
            borderColor={theme.border}
            paddingLeft={1}
            paddingRight={1}
          >
            <text
              content=" collections "
              fg={theme.textMuted}
              attributes={TextAttributes.BOLD}
              flexShrink={0}
            />
            {collections.length === 0 ? (
              <text
                content={displayText(isPending ? 'Loading…' : 'No collections')}
                fg={theme.textMuted}
              />
            ) : (
              collections.map(function renderCollectionRow(collection, index) {
                const highlighted = index === selectedCollectionIndex
                return (
                  <box
                    key={collection.name}
                    flexDirection="row"
                    gap={1}
                    backgroundColor={highlighted ? theme.primary : undefined}
                  >
                    <text
                      content={displayText(collection.name)}
                      fg={highlighted ? highlightFg : theme.text}
                      flexGrow={1}
                    />
                    <text
                      content={displayText(String(collection.indexes.length))}
                      fg={highlighted ? highlightFg : theme.textMuted}
                      flexShrink={0}
                    />
                  </box>
                )
              })
            )}
          </box>

          <box
            flexGrow={1}
            flexShrink={1}
            flexDirection="column"
            border
            borderStyle="single"
            borderColor={theme.border}
            paddingLeft={1}
            paddingRight={1}
          >
            <IndexDetailPanel collection={focusedCollection} isPending={isPending} />
          </box>
        </box>
      )}
    </box>
  )
}

type IndexDetailPanelProps = {
  collection: CollectionIndexes | null
  isPending: boolean
}

function IndexDetailPanel({ collection, isPending }: IndexDetailPanelProps) {
  const theme = useTheme((s) => s.theme)

  if (collection == null) {
    return (
      <text
        content={displayText(isPending ? 'Loading indexes…' : 'Select a collection')}
        fg={theme.textMuted}
      />
    )
  }

  return (
    <box flexDirection="column" gap={0} flexGrow={1}>
      <box flexDirection="row" justifyContent="space-between" flexShrink={0} paddingBottom={0}>
        <text
          content={displayText(` ${collection.name} `)}
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

      {collection.error != null ? (
        <text content={displayText(collection.error.message)} fg={theme.error} />
      ) : null}

      {collection.usageUnavailable ? (
        <text content="usage n/a (needs indexStats / clusterMonitor)" fg={theme.textMuted} />
      ) : null}

      {collection.error == null && collection.indexes.length === 0 ? (
        <text content="No indexes" fg={theme.textMuted} />
      ) : null}

      {collection.indexes.length > 0 ? (
        <>
          <IndexHeaderRow />
          {collection.indexes.map(function renderIndexRow(row) {
            return <IndexDataRow key={row.name} row={row} />
          })}
        </>
      ) : null}
    </box>
  )
}

function IndexHeaderRow() {
  const theme = useTheme((s) => s.theme)
  return (
    <box flexDirection="row" gap={1} flexShrink={0}>
      <text content="name" fg={theme.textMuted} width={18} />
      <text content="keys" fg={theme.textMuted} width={22} />
      <text content="opts" fg={theme.textMuted} width={16} />
      <text content="size" fg={theme.textMuted} width={10} />
      <text content="ops" fg={theme.textMuted} width={8} />
      <text content="since" fg={theme.textMuted} />
    </box>
  )
}

type IndexDataRowProps = {
  row: IndexRow
}

function IndexDataRow({ row }: IndexDataRowProps) {
  const theme = useTheme((s) => s.theme)
  return (
    <box flexDirection="row" gap={1} flexShrink={0}>
      <text content={displayText(row.name)} fg={theme.text} width={18} />
      <text content={displayText(row.keyLabel)} fg={theme.text} width={22} />
      <text content={displayText(formatIndexFlags(row.flags))} fg={theme.textMuted} width={16} />
      <text content={displayText(formatBytes(row.sizeBytes))} fg={theme.textMuted} width={10} />
      <text content={displayText(formatOps(row.ops))} fg={theme.textMuted} width={8} />
      <text content={displayText(formatSince(row.since))} fg={theme.textMuted} />
    </box>
  )
}
