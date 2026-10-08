import { type CliRenderer } from '@opentui/core'
import { spawnSync } from 'node:child_process'

export type ClipboardWriteResult =
  | { status: 'sent' }
  | { status: 'copied' }
  | { status: 'failed'; message: string }

type ClipboardRenderer = Pick<CliRenderer, 'copyToClipboardOSC52' | 'isOsc52Supported'>

const LOCAL_CLIP_TOOLS: ReadonlyArray<{ command: string; args: readonly string[] }> = [
  { command: 'wl-copy', args: [] },
  { command: 'xclip', args: ['-selection', 'clipboard'] },
  { command: 'xsel', args: ['--clipboard', '--input'] },
  { command: 'pbcopy', args: [] },
  { command: 'clip.exe', args: [] },
]

/**
 * Copy plain text to the system clipboard.
 *
 * Primary path: OpenTUI OSC 52 (`renderer.copyToClipboardOSC52`). A `true`
 * return only means the sequence was handed to the output path — terminals and
 * multiplexers may still drop it with no acknowledgement.
 *
 * Fallback: spawn a local clipboard tool when OSC 52 is unsupported or the
 * write returns false. Local success is exit-code confirmed; OSC 52 is not.
 */
export function writeClipboardText(
  renderer: ClipboardRenderer,
  text: string,
): ClipboardWriteResult {
  if (text === '' || text === 'undefined') {
    return { status: 'failed', message: 'Nothing to copy' }
  }

  if (renderer.isOsc52Supported()) {
    const ok = renderer.copyToClipboardOSC52(text)
    if (ok) {
      return { status: 'sent' }
    }
  }

  if (tryLocalClipboard(text)) {
    return { status: 'copied' }
  }

  return {
    status: 'failed',
    message: renderer.isOsc52Supported()
      ? 'Clipboard write failed'
      : 'Clipboard not supported in this terminal',
  }
}

function tryLocalClipboard(text: string): boolean {
  for (const tool of LOCAL_CLIP_TOOLS) {
    const result = spawnSync(tool.command, [...tool.args], {
      input: text,
      encoding: 'utf8',
    })
    if (result.error == null && result.status === 0) {
      return true
    }
  }
  return false
}
