import { TextAttributes } from '@opentui/core'
import { useBindings } from '@opentui/keymap/react'
import { useEffect } from 'react'
import { formatRunningMs, type KillOpTarget } from '../../../../live-ops'
import { displayText } from '../../../../lib/display-text'
import { type AppKeymapMode } from '../../../lib/keymap-mode'
import { useFooter } from '../../../stores/footer'
import { useTheme } from '../../../stores/theme'
import { Dialog } from '../../ui/dialog'
import { LIVE_OPS_KILL_CONFIRM_FOOTER } from '../../../shortcuts/live-ops'

type KillOpConfirmDialogProps = {
  open: boolean
  target: KillOpTarget | null
  isPending: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function KillOpConfirmDialog({
  open,
  target,
  isPending,
  onConfirm,
  onCancel,
}: KillOpConfirmDialogProps) {
  const theme = useTheme((s) => s.theme)
  const pushOverlayKeybindings = useFooter((s) => s.pushOverlayKeybindings)
  const popOverlayKeybindings = useFooter((s) => s.popOverlayKeybindings)

  useEffect(
    function syncKillConfirmFooter() {
      if (!open) {
        return
      }
      pushOverlayKeybindings('kill-op-confirm', LIVE_OPS_KILL_CONFIRM_FOOTER)
      return function clearKillConfirmFooter() {
        popOverlayKeybindings('kill-op-confirm')
      }
    },
    [open, popOverlayKeybindings, pushOverlayKeybindings],
  )

  useBindings(
    function createKillConfirmLayer() {
      return {
        appMode: 'palette' satisfies AppKeymapMode,
        enabled: open && !isPending,
        priority: 50,
        commands: [
          {
            name: 'live-ops.kill-confirm',
            run() {
              onConfirm()
            },
          },
          {
            name: 'live-ops.kill-cancel',
            run() {
              onCancel()
            },
          },
        ],
        bindings: [
          { key: 'return', cmd: 'live-ops.kill-confirm' },
          { key: 'enter', cmd: 'live-ops.kill-confirm' },
          { key: 'escape', cmd: 'live-ops.kill-cancel' },
        ],
      }
    },
    [isPending, onCancel, onConfirm, open],
  )

  if (!open || target == null) {
    return null
  }

  const planLabel = target.plan === 'n/a' ? '—' : target.plan

  return (
    <Dialog open onClose={onCancel} width={56}>
      <box paddingLeft={2} paddingRight={2} paddingBottom={1} gap={1}>
        <text content="Kill operation?" fg={theme.text} attributes={TextAttributes.BOLD} />
        <text content={displayText(`opid:      ${target.opid}`)} fg={theme.textMuted} />
        <text content={displayText(`namespace: ${target.namespace}`)} fg={theme.textMuted} />
        <text content={displayText(`op:        ${target.op}`)} fg={theme.textMuted} />
        <text content={displayText(`plan:      ${planLabel}`)} fg={theme.textMuted} />
        <text content={displayText(`client:    ${target.client}`)} fg={theme.textMuted} />
        <text
          content={displayText(`running:   ${formatRunningMs(target.runningMs)} ms`)}
          fg={theme.textMuted}
        />
        <text
          content={isPending ? 'killing…' : 'enter confirm · esc cancel'}
          fg={theme.textMuted}
        />
      </box>
    </Dialog>
  )
}
