import { RGBA } from '@opentui/core'
import { useBindings, useKeymap } from '@opentui/keymap/react'
import { useRenderer, useTerminalDimensions } from '@opentui/react'
import { useEffect, useRef, type ReactNode } from 'react'
import { type AppKeymapMode } from '../../lib/keymap-mode'
import { useTheme } from '../../stores/theme'

/** Nested dialogs share one palette-mode session via refcount. */
let openDialogCount = 0

type DialogProps = {
  open: boolean
  onClose?: () => void
  children?: ReactNode
  width?: number
  /** Vertical offset from the top of the terminal (default: ~1/4 height). */
  paddingTop?: number
}

export function Dialog({
  open,
  onClose,
  children,
  width: widthProp,
  paddingTop: paddingTopProp,
}: DialogProps) {
  const renderer = useRenderer()
  const keymap = useKeymap()
  const dimensions = useTerminalDimensions()
  const theme = useTheme((s) => s.theme)
  const dismissRef = useRef(false)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(
    function syncDialogKeymapMode() {
      if (!open) return

      openDialogCount += 1
      keymap.setData('app.mode', 'palette' satisfies AppKeymapMode)

      return function restoreDialogKeymapMode() {
        openDialogCount = Math.max(0, openDialogCount - 1)
        keymap.setData(
          'app.mode',
          (openDialogCount > 0 ? 'palette' : 'base') satisfies AppKeymapMode,
        )
      }
    },
    [keymap, open],
  )

  useBindings(
    function createDialogLayer() {
      return {
        appMode: 'palette' satisfies AppKeymapMode,
        enabled: open,
        commands: [
          {
            name: 'dialog.close',
            run() {
              onCloseRef.current?.()
            },
          },
        ],
        bindings: [{ key: 'escape', cmd: 'dialog.close' }],
      }
    },
    [open],
  )

  if (!open) return null

  const width = widthProp ?? Math.min(60, dimensions.width - 2)
  const paddingTop = paddingTopProp ?? Math.floor(dimensions.height / 4)

  return (
    <box
      width={dimensions.width}
      height={dimensions.height}
      alignItems="center"
      position="absolute"
      zIndex={3000}
      paddingTop={paddingTop}
      left={0}
      top={0}
      backgroundColor={RGBA.fromInts(0, 0, 0, 150)}
      onMouseDown={() => {
        dismissRef.current = !!renderer.getSelection()
      }}
      onMouseUp={() => {
        if (dismissRef.current) {
          dismissRef.current = false
          return
        }
        onClose?.()
      }}
    >
      <box
        width={width}
        maxWidth={dimensions.width - 2}
        backgroundColor={theme.backgroundPanel}
        paddingTop={1}
        onMouseUp={(event: { stopPropagation(): void }) => {
          if (renderer.getSelection()?.getSelectedText()) return
          dismissRef.current = false
          event.stopPropagation()
        }}
      >
        {children}
      </box>
    </box>
  )
}
