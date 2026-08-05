import { RGBA } from '@opentui/core'
import { useBindings } from '@opentui/keymap/react'
import { useRenderer, useTerminalDimensions } from '@opentui/react'
import { useRef, type ReactNode } from 'react'
import { type AppKeymapMode } from '../../lib/keymap-mode'
import { useTheme } from '../../stores/theme'

type DialogProps = {
  open: boolean
  onClose?: () => void
  children?: ReactNode
  width?: number
}

export function Dialog({ open, onClose, children, width: widthProp }: DialogProps) {
  const renderer = useRenderer()
  const dimensions = useTerminalDimensions()
  const theme = useTheme((s) => s.theme)
  const dismissRef = useRef(false)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

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

  return (
    <box
      width={dimensions.width}
      height={dimensions.height}
      alignItems="center"
      position="absolute"
      zIndex={3000}
      paddingTop={Math.floor(dimensions.height / 4)}
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
