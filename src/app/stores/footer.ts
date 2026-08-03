import { create } from 'zustand'

export type FooterKeybinding = {
  keys: string
  label: string
}

type FooterState = {
  keybindings: FooterKeybinding[]
  setKeybindings: (keybindings: FooterKeybinding[]) => void
  resetKeybindings: () => void
}

const DEFAULT_KEYBINDINGS: FooterKeybinding[] = [
  { keys: 'ctrl+k', label: 'commands' },
  { keys: 'q', label: 'quit' },
]

export const useFooter = create<FooterState>((set) => ({
  keybindings: DEFAULT_KEYBINDINGS,
  setKeybindings(keybindings) {
    set({ keybindings: [...keybindings, ...DEFAULT_KEYBINDINGS] })
  },
  resetKeybindings() {
    set({ keybindings: DEFAULT_KEYBINDINGS })
  },
}))
