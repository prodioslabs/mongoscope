import { TextAttributes } from '@opentui/core'
import { useTerminalDimensions } from '@opentui/react'
import { useEffect, useRef } from 'react'
import { HELP_SECTIONS, type HelpBinding } from '../shortcuts'
import { useFooter, type FooterKeybinding } from '../stores/footer'
import { useTheme } from '../stores/theme'
import { Dialog } from './ui/dialog'

const HELP_OVERLAY_KEYBINDINGS: FooterKeybinding[] = [{ keys: 'esc', label: 'close' }]

type HelpMenuProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function HelpMenu({ open, onOpenChange }: HelpMenuProps) {
  const theme = useTheme((s) => s.theme)
  const dimensions = useTerminalDimensions()
  const pushOverlayKeybindings = useFooter((s) => s.pushOverlayKeybindings)
  const popOverlayKeybindings = useFooter((s) => s.popOverlayKeybindings)
  const onOpenChangeRef = useRef(onOpenChange)
  onOpenChangeRef.current = onOpenChange

  useEffect(
    function syncFooterOverlayKeybindings() {
      if (!open) return
      pushOverlayKeybindings('help-menu', HELP_OVERLAY_KEYBINDINGS)
      return function clearFooterOverlayKeybindings() {
        popOverlayKeybindings('help-menu')
      }
    },
    [open, pushOverlayKeybindings, popOverlayKeybindings],
  )

  function handleClose() {
    onOpenChangeRef.current(false)
  }

  const paddingTop = Math.max(1, Math.floor(dimensions.height / 10))
  const bodyHeight = Math.max(8, dimensions.height - paddingTop - 6)

  return (
    <Dialog open={open} onClose={handleClose} width={56} paddingTop={paddingTop}>
      <box gap={1} paddingBottom={1}>
        <box paddingLeft={3} paddingRight={3}>
          <box flexDirection="row" justifyContent="space-between">
            <text fg={theme.text} attributes={TextAttributes.BOLD}>
              Keyboard shortcuts
            </text>
            <text fg={theme.textMuted} onMouseUp={handleClose}>
              esc
            </text>
          </box>
        </box>
        <scrollbox
          height={bodyHeight}
          width="100%"
          scrollX={false}
          scrollY
          paddingLeft={2}
          paddingRight={2}
          horizontalScrollbarOptions={{ visible: false }}
        >
          <box flexDirection="column" gap={1} flexShrink={0}>
            {HELP_SECTIONS.map((section) => (
              <box key={section.title} flexDirection="column" gap={0}>
                <box paddingLeft={1} paddingBottom={0}>
                  <text fg={theme.accent} attributes={TextAttributes.BOLD}>
                    {section.title}
                  </text>
                </box>
                {section.bindings.map((binding) => (
                  <HelpBindingRow key={`${section.title}:${binding.keys}`} binding={binding} />
                ))}
              </box>
            ))}
          </box>
        </scrollbox>
      </box>
    </Dialog>
  )
}

type HelpBindingRowProps = {
  binding: HelpBinding
}

function HelpBindingRow({ binding }: HelpBindingRowProps) {
  const theme = useTheme((s) => s.theme)

  return (
    <box flexDirection="row" paddingLeft={1} paddingRight={1} gap={2}>
      <text fg={theme.text} attributes={TextAttributes.BOLD} width={14} flexShrink={0}>
        {binding.keys}
      </text>
      <text fg={theme.textMuted} flexGrow={1}>
        {binding.label}
      </text>
    </box>
  )
}
