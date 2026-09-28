import { TextAttributes } from '@opentui/core'
import { useBindings } from '@opentui/keymap/react'
import { useEffect } from 'react'
import { displayText } from '../../../../lib/display-text'
import { type AppKeymapMode } from '../../../lib/keymap-mode'
import { WELCOME_ELEVATED_CONFIRM_FOOTER } from '../../../shortcuts/welcome'
import { useFooter } from '../../../stores/footer'
import { useTheme } from '../../../stores/theme'
import { Dialog } from '../../ui/dialog'

type ElevatedLogAccessDialogProps = {
  open: boolean
  directory: string
  purpose: 'list' | 'read'
  isPending: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ElevatedLogAccessDialog({
  open,
  directory,
  purpose,
  isPending,
  onConfirm,
  onCancel,
}: ElevatedLogAccessDialogProps) {
  const theme = useTheme((s) => s.theme)
  const pushOverlayKeybindings = useFooter((s) => s.pushOverlayKeybindings)
  const popOverlayKeybindings = useFooter((s) => s.popOverlayKeybindings)

  useEffect(
    function syncElevatedConfirmFooter() {
      if (!open) {
        return
      }
      pushOverlayKeybindings('elevated-log-access-confirm', WELCOME_ELEVATED_CONFIRM_FOOTER)
      return function clearElevatedConfirmFooter() {
        popOverlayKeybindings('elevated-log-access-confirm')
      }
    },
    [open, popOverlayKeybindings, pushOverlayKeybindings],
  )

  useBindings(
    function createElevatedConfirmLayer() {
      return {
        appMode: 'palette' satisfies AppKeymapMode,
        enabled: open && !isPending,
        priority: 50,
        commands: [
          {
            name: 'welcome.elevated-confirm',
            run() {
              onConfirm()
            },
          },
          {
            name: 'welcome.elevated-cancel',
            run() {
              onCancel()
            },
          },
        ],
        bindings: [
          { key: 'return', cmd: 'welcome.elevated-confirm' },
          { key: 'enter', cmd: 'welcome.elevated-confirm' },
          { key: 'escape', cmd: 'welcome.elevated-cancel' },
        ],
      }
    },
    [isPending, onCancel, onConfirm, open],
  )

  if (!open) {
    return null
  }

  const actionLine =
    purpose === 'list'
      ? 'Will run a short-lived sudo command to list this directory.'
      : 'Will run a short-lived sudo command to read a log file from this directory.'

  return (
    <Dialog open onClose={onCancel} width={64}>
      <box paddingLeft={2} paddingRight={2} paddingBottom={1} gap={1}>
        <text
          content="Read with elevated permissions?"
          fg={theme.text}
          attributes={TextAttributes.BOLD}
        />
        <text content={displayText(directory)} fg={theme.textMuted} />
        <text content={actionLine} fg={theme.textMuted} />
        <text content="Your password may be requested." fg={theme.textMuted} />
        <text content="The app itself will not run as root." fg={theme.warning} />
        <text
          content={isPending ? 'waiting for sudo…' : 'enter confirm · esc cancel'}
          fg={theme.textMuted}
        />
      </box>
    </Dialog>
  )
}
