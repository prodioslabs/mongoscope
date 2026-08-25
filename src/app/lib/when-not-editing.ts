import { type CliRenderer } from '@opentui/core'

/**
 * Keymap `enabled` callback: true when no text input/editor currently has focus.
 * Plain functions are re-checked on every keypress, so typing letters like `t`/`m`
 * are not stolen by global shortcuts while an `<input>` is focused.
 */
export function whenNotEditing(renderer: CliRenderer): () => boolean {
  return function isNotEditing() {
    return renderer.currentFocusedEditor == null
  }
}
