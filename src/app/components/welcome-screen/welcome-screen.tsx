import { RGBA, ScrollBoxRenderable, TextAttributes, type CliRenderer } from '@opentui/core'
import { useBindings } from '@opentui/keymap/react'
import { useRenderer } from '@opentui/react'
import { join } from 'node:path'
import { useEffect, useRef, useState } from 'react'
import {
  elevatedFailureMessage,
  isDirectorySessionElevated,
  isPermissionDeniedMessage,
  listLogFilesElevated,
} from '../../lib/elevated-log-access'
import {
  filesFromListResult,
  listLogFiles,
  MONGODB_DEFAULT_LOG_DIR,
  type ListLogFilesResult,
} from '../../lib/list-log-files'
import { type AppKeymapMode } from '../../lib/keymap-mode'
import {
  toBindings,
  toFooter,
  WELCOME_PARSING_FOOTER,
  WELCOME_PERMISSION_FOOTER,
  WELCOME_SHORTCUTS,
} from '../../shortcuts'
import { useFooterKeybindings } from '../footer-keybindings'
import { useSession } from '../../stores/session'
import { useTheme } from '../../stores/theme'
import { selectedForeground } from '../../theme'
import { ElevatedLogAccessDialog } from './elevated-log-access-dialog'

const MAX_VISIBLE_FILES = 5
const MAX_SECTION_WIDTH = 80
const PROGRESS_BAR_WIDTH = 24
const TRANSPARENT = RGBA.fromInts(0, 0, 0, 0)

const WELCOME_IDLE_KEYBINDINGS = toFooter(WELCOME_SHORTCUTS)

const INITIAL_LIST_RESULT: ListLogFilesResult = { status: 'empty' }

const SCOPE = [
  '  ▄███████████▄  ',
  '  █           █  ',
  '  █    ▄█▄    █  ',
  '  █ ▄▄▄█ █▄▄▄ █  ',
  '  █           █  ',
  '  ▀███████████▀  ',
].join('\n')

type ConfirmPurpose = 'list' | 'read'

type WelcomeScreenProps = {
  logDir: string
}

export function WelcomeScreen({ logDir }: WelcomeScreenProps) {
  const theme = useTheme((s) => s.theme)
  const renderer = useRenderer() as CliRenderer
  const parseProgress = useSession((s) => s.parseProgress)
  const parseError = useSession((s) => s.parseError)
  const startParse = useSession((s) => s.startParse)
  const parsing = parseProgress !== null

  const [mongoList, setMongoList] = useState<ListLogFilesResult>(INITIAL_LIST_RESULT)
  const [dirList, setDirList] = useState<ListLogFilesResult>(INITIAL_LIST_RESULT)
  const [activeSection, setActiveSection] = useState(0)
  const [selectedIndexes, setSelectedIndexes] = useState<[number, number]>([0, 0])
  const [confirmDirectory, setConfirmDirectory] = useState<string | null>(null)
  const [confirmPurpose, setConfirmPurpose] = useState<ConfirmPurpose>('list')
  const [pendingReadPath, setPendingReadPath] = useState<string | null>(null)
  const [elevatePending, setElevatePending] = useState(false)
  const [mongoElevateError, setMongoElevateError] = useState<string | null>(null)
  const [dirElevateError, setDirElevateError] = useState<string | null>(null)

  const mongoLogs = filesFromListResult(mongoList)
  const dirLogs = filesFromListResult(dirList)

  const activeList = activeSection === 0 ? mongoList : dirList
  const needsSudoFooter =
    !parsing &&
    confirmDirectory == null &&
    (activeList.status === 'permission_denied' ||
      (parseError != null && isPermissionDeniedMessage(parseError)))

  useFooterKeybindings(
    needsSudoFooter
      ? WELCOME_PERMISSION_FOOTER
      : parsing
        ? WELCOME_PARSING_FOOTER
        : WELCOME_IDLE_KEYBINDINGS,
  )

  useEffect(
    function loadLogFileLists() {
      let cancelled = false

      async function load() {
        const [mongoResult, dirResult] = await Promise.all([
          listLogFiles(MONGODB_DEFAULT_LOG_DIR),
          listLogFiles(logDir),
        ])
        if (cancelled) {
          return
        }

        setMongoList(mongoResult)
        setDirList(dirResult)
        setMongoElevateError(null)
        setDirElevateError(null)
        setSelectedIndexes([0, 0])
      }

      void load()

      return function cancelLoadLogFileLists() {
        cancelled = true
      }
    },
    [logDir],
  )

  useEffect(
    function clampSelectionToFiles() {
      setSelectedIndexes(([mongoIndex, dirIndex]) => [
        mongoLogs.length === 0 ? 0 : Math.min(mongoIndex, mongoLogs.length - 1),
        dirLogs.length === 0 ? 0 : Math.min(dirIndex, dirLogs.length - 1),
      ])
    },
    [mongoLogs.length, dirLogs.length],
  )

  const activeSectionRef = useRef(activeSection)
  const selectedIndexesRef = useRef(selectedIndexes)
  const mongoLogsRef = useRef(mongoLogs)
  const dirLogsRef = useRef(dirLogs)
  const mongoListRef = useRef(mongoList)
  const dirListRef = useRef(dirList)
  const logDirRef = useRef(logDir)
  const elevatePendingRef = useRef(elevatePending)
  const parseErrorRef = useRef(parseError)

  activeSectionRef.current = activeSection
  selectedIndexesRef.current = selectedIndexes
  mongoLogsRef.current = mongoLogs
  dirLogsRef.current = dirLogs
  mongoListRef.current = mongoList
  dirListRef.current = dirList
  logDirRef.current = logDir
  elevatePendingRef.current = elevatePending
  parseErrorRef.current = parseError

  function openConfirm(directory: string, purpose: ConfirmPurpose, readPath: string | null) {
    setConfirmPurpose(purpose)
    setPendingReadPath(readPath)
    setConfirmDirectory(directory)
  }

  async function analyzeSelectedFile() {
    const section = activeSectionRef.current
    const files = section === 0 ? mongoLogsRef.current : dirLogsRef.current
    const name = files[selectedIndexesRef.current[section] ?? 0]
    if (!name) {
      return
    }
    const dir = section === 0 ? MONGODB_DEFAULT_LOG_DIR : logDirRef.current
    const path = join(dir, name)

    if (isDirectorySessionElevated(dir)) {
      await startParse(path, { elevatedRenderer: renderer })
      return
    }

    const result = await startParse(path)
    if (result === 'permission_denied') {
      openConfirm(dir, 'read', path)
    }
  }

  function requestSudoForActiveSection() {
    if (elevatePendingRef.current) {
      return
    }
    const section = activeSectionRef.current
    const list = section === 0 ? mongoListRef.current : dirListRef.current
    const dir = section === 0 ? MONGODB_DEFAULT_LOG_DIR : logDirRef.current

    if (list.status === 'permission_denied') {
      openConfirm(dir, 'list', null)
      return
    }

    const error = parseErrorRef.current
    if (error != null && isPermissionDeniedMessage(error)) {
      const files = section === 0 ? mongoLogsRef.current : dirLogsRef.current
      const name = files[selectedIndexesRef.current[section] ?? 0]
      if (name) {
        openConfirm(dir, 'read', join(dir, name))
        return
      }
    }
  }

  useBindings(
    function createWelcomeScreenLayer() {
      function logFilesForSection(section: number) {
        return section === 0 ? mongoLogsRef.current : dirLogsRef.current
      }

      function selectIndexInSection(section: number, index: number) {
        setSelectedIndexes((indexes) => {
          if (indexes[section] === index) {
            return indexes
          }
          const next = [...indexes] as [number, number]
          next[section] = index
          return next
        })
      }

      function navigateSelection(delta: number) {
        const section = activeSectionRef.current
        const files = logFilesForSection(section)
        const nextIndex = (selectedIndexesRef.current[section] ?? 0) + delta

        if (files.length > 0 && nextIndex >= 0 && nextIndex < files.length) {
          selectIndexInSection(section, nextIndex)
          return
        }

        const otherSection = 1 - section
        const otherSectionFiles = logFilesForSection(otherSection)
        setActiveSection(otherSection)
        if (otherSectionFiles.length > 0) {
          selectIndexInSection(otherSection, delta < 0 ? otherSectionFiles.length - 1 : 0)
        }
      }

      return {
        appMode: 'base' satisfies AppKeymapMode,
        enabled: !parsing && confirmDirectory == null && !elevatePending,
        commands: [
          {
            name: 'welcome.analyze',
            run() {
              void analyzeSelectedFile()
            },
          },
          {
            name: 'welcome.toggle-section',
            run() {
              setActiveSection((section) => 1 - section)
            },
          },
          {
            name: 'welcome.move-up',
            run() {
              navigateSelection(-1)
            },
          },
          {
            name: 'welcome.move-down',
            run() {
              navigateSelection(1)
            },
          },
          {
            name: 'welcome.retry-sudo',
            run() {
              requestSudoForActiveSection()
            },
          },
        ],
        bindings: toBindings(WELCOME_SHORTCUTS),
      }
    },
    [confirmDirectory, elevatePending, parsing, renderer],
  )

  async function runElevatedConfirm() {
    if (confirmDirectory == null) {
      return
    }
    const directory = confirmDirectory
    const purpose = confirmPurpose
    const readPath = pendingReadPath

    setElevatePending(true)

    if (purpose === 'list') {
      const result = await listLogFilesElevated({
        renderer,
        dir: directory,
      })
      setElevatePending(false)
      setConfirmDirectory(null)
      setPendingReadPath(null)

      const isMongoDir = directory === MONGODB_DEFAULT_LOG_DIR
      if (!result.ok) {
        if (isMongoDir) {
          setMongoElevateError(result.message)
        } else {
          setDirElevateError(result.message)
        }
        return
      }

      if (isMongoDir) {
        setMongoList(result.value)
        setMongoElevateError(null)
      } else {
        setDirList(result.value)
        setDirElevateError(null)
      }
      setSelectedIndexes([0, 0])
      return
    }

    if (readPath == null) {
      setElevatePending(false)
      setConfirmDirectory(null)
      return
    }

    const result = await startParse(readPath, { elevatedRenderer: renderer })
    setElevatePending(false)
    setConfirmDirectory(null)
    setPendingReadPath(null)

    if (result !== 'ok') {
      const message = useSession.getState().parseError ?? elevatedFailureMessage('other')
      if (directory === MONGODB_DEFAULT_LOG_DIR) {
        setMongoElevateError(message)
      } else {
        setDirElevateError(message)
      }
    } else if (directory === MONGODB_DEFAULT_LOG_DIR) {
      setMongoElevateError(null)
    } else {
      setDirElevateError(null)
    }
  }

  return (
    <box
      flexGrow={1}
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      paddingTop={1}
      maxWidth={320}
      gap={0}
    >
      <box
        flexShrink={0}
        flexDirection="row"
        alignItems="center"
        justifyContent="center"
        marginBottom={2}
      >
        <text content={SCOPE} fg={theme.accent} />
        <box flexDirection="column" alignItems="flex-start">
          <ascii-font text="MongoScope" color={theme.text} />
          <text content="a lens into your MongoDB" fg={theme.textMuted} />
        </box>
      </box>
      <text content="Select a log file to analyze" fg={theme.textMuted} />
      <box
        flexDirection="column"
        paddingLeft={1}
        paddingRight={1}
        width={MAX_SECTION_WIDTH}
        maxWidth={MAX_SECTION_WIDTH}
      >
        <LogFileSection
          sectionId="mongo"
          title="MongoDB logs"
          dir={MONGODB_DEFAULT_LOG_DIR}
          list={mongoList}
          elevateError={mongoElevateError}
          active={activeSection === 0}
          selectedIndex={selectedIndexes[0]}
          onSelectIndex={(index) => {
            if (parsing) {
              return
            }
            setActiveSection(0)
            setSelectedIndexes((indexes) => [index, indexes[1]])
          }}
          onRetrySudo={() => {
            if (parsing || elevatePending) {
              return
            }
            setActiveSection(0)
            if (mongoList.status === 'permission_denied') {
              openConfirm(MONGODB_DEFAULT_LOG_DIR, 'list', null)
              return
            }
            if (parseError != null && isPermissionDeniedMessage(parseError)) {
              const name = mongoLogs[selectedIndexes[0] ?? 0]
              if (name) {
                openConfirm(MONGODB_DEFAULT_LOG_DIR, 'read', join(MONGODB_DEFAULT_LOG_DIR, name))
              }
            }
          }}
        />
        <LogFileSection
          sectionId="log-dir"
          title="Log directory"
          dir={logDir}
          list={dirList}
          elevateError={dirElevateError}
          active={activeSection === 1}
          selectedIndex={selectedIndexes[1]}
          onSelectIndex={(index) => {
            if (parsing) {
              return
            }
            setActiveSection(1)
            setSelectedIndexes((indexes) => [indexes[0], index])
          }}
          onRetrySudo={() => {
            if (parsing || elevatePending) {
              return
            }
            setActiveSection(1)
            if (dirList.status === 'permission_denied') {
              openConfirm(logDir, 'list', null)
              return
            }
            if (parseError != null && isPermissionDeniedMessage(parseError)) {
              const name = dirLogs[selectedIndexes[1] ?? 0]
              if (name) {
                openConfirm(logDir, 'read', join(logDir, name))
              }
            }
          }}
        />
        {parseProgress !== null ? (
          <box flexDirection="column" marginTop={1} gap={0}>
            <text fg={theme.textMuted}>
              Parsing… {parseProgress}% {progressBar(parseProgress)}
            </text>
          </box>
        ) : null}
        {parseError ? (
          <text fg={theme.error} marginTop={1}>
            {parseError}
          </text>
        ) : null}
      </box>
      <ElevatedLogAccessDialog
        open={confirmDirectory != null}
        directory={confirmDirectory ?? ''}
        purpose={confirmPurpose}
        isPending={elevatePending}
        onConfirm={() => {
          if (confirmDirectory == null || elevatePending) {
            return
          }
          void runElevatedConfirm()
        }}
        onCancel={() => {
          if (elevatePending) {
            return
          }
          const directory = confirmDirectory
          setConfirmDirectory(null)
          setPendingReadPath(null)
          if (directory == null) {
            return
          }
          const message = elevatedFailureMessage('cancelled')
          if (directory === MONGODB_DEFAULT_LOG_DIR) {
            setMongoElevateError(message)
          } else {
            setDirElevateError(message)
          }
        }}
      />
    </box>
  )
}

function progressBar(percent: number): string {
  const filled = Math.round((percent / 100) * PROGRESS_BAR_WIDTH)
  return `[${'█'.repeat(filled)}${'░'.repeat(PROGRESS_BAR_WIDTH - filled)}]`
}

function listStatusMessage(list: ListLogFilesResult): { content: string; tone: 'muted' | 'error' } {
  switch (list.status) {
    case 'ok':
      return { content: '', tone: 'muted' }
    case 'empty':
      return { content: 'No log files found', tone: 'muted' }
    case 'not_found':
      return {
        content:
          "Directory does not exist — pick a different path or confirm MongoDB's log location on this system",
        tone: 'error',
      }
    case 'permission_denied':
      return {
        content: 'Permission denied — cannot read this directory',
        tone: 'error',
      }
    case 'other':
      return { content: list.message, tone: 'error' }
  }
}

type LogFileSectionProps = {
  sectionId: string
  title: string
  dir: string
  list: ListLogFilesResult
  elevateError: string | null
  active: boolean
  selectedIndex: number
  onSelectIndex: (index: number) => void
  onRetrySudo: () => void
}

function LogFileSection({
  sectionId,
  title,
  dir,
  list,
  elevateError,
  active,
  selectedIndex,
  onSelectIndex,
  onRetrySudo,
}: LogFileSectionProps) {
  const theme = useTheme((s) => s.theme)
  const highlightFg = selectedForeground(theme)
  const files = filesFromListResult(list)
  const needsScroll = files.length > MAX_VISIBLE_FILES
  const status = listStatusMessage(list)
  const showPermissionRetry = list.status === 'permission_denied'
  const emptyLineCount =
    files.length > 0
      ? files.length
      : 1 + (showPermissionRetry ? 1 : 0) + (elevateError != null ? 1 : 0)
  const listHeight = Math.min(Math.max(emptyLineCount, 1), MAX_VISIBLE_FILES)
  const scrollRef = useRef<ScrollBoxRenderable | null>(null)

  useEffect(
    function scrollHighlightedFileIntoView() {
      if (!active || !needsScroll) {
        return
      }
      const scroll = scrollRef.current
      if (!scroll) {
        return
      }
      scroll.scrollChildIntoView(`${sectionId}-file-${selectedIndex}`)
    },
    [active, needsScroll, sectionId, selectedIndex],
  )

  const rows =
    files.length > 0 ? (
      files.map((name, index) => {
        const highlighted = active && index === selectedIndex
        const fg = highlighted ? highlightFg : theme.text
        return (
          <box
            key={name}
            id={`${sectionId}-file-${index}`}
            flexDirection="row"
            gap={1}
            backgroundColor={highlighted ? theme.primary : TRANSPARENT}
            onMouseOver={() => onSelectIndex(index)}
            onMouseDown={() => onSelectIndex(index)}
            paddingLeft={1}
            paddingRight={1}
          >
            <text
              content={name}
              fg={fg}
              attributes={highlighted ? TextAttributes.BOLD : undefined}
              flexGrow={1}
            />
            <text flexShrink={0} content={highlighted ? '●' : ' '} fg={fg} />
          </box>
        )
      })
    ) : (
      <box flexDirection="column">
        <text
          content={status.content}
          fg={status.tone === 'error' ? theme.error : theme.textMuted}
        />
        {showPermissionRetry ? (
          <text
            content={active ? 'r retry with sudo' : 'select section, then r for sudo'}
            fg={theme.accent}
            onMouseDown={() => {
              if (active) {
                onRetrySudo()
              }
            }}
          />
        ) : null}
        {elevateError != null ? <text content={elevateError} fg={theme.error} /> : null}
      </box>
    )

  return (
    <box
      flexShrink={0}
      flexDirection="column"
      borderStyle="single"
      borderColor={active ? theme.borderActive : theme.borderSubtle}
      paddingLeft={1}
      paddingRight={1}
    >
      <text fg={active ? theme.accent : theme.textMuted}>
        {title} ({dir})
      </text>
      {needsScroll ? (
        <scrollbox
          ref={scrollRef}
          focusable={false}
          height={MAX_VISIBLE_FILES}
          backgroundColor={theme.backgroundElement}
          rootOptions={{ backgroundColor: theme.backgroundElement }}
          viewportOptions={{ backgroundColor: theme.backgroundElement }}
          contentOptions={{ backgroundColor: theme.backgroundElement }}
          scrollbarOptions={{
            trackOptions: {
              foregroundColor: theme.border,
              backgroundColor: theme.backgroundElement,
            },
          }}
        >
          {rows}
        </scrollbox>
      ) : (
        <box height={listHeight} flexDirection="column" backgroundColor={theme.backgroundElement}>
          {rows}
        </box>
      )}
    </box>
  )
}
