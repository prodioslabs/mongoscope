import { create } from 'zustand'

export type FooterKeybinding = {
  keys: string
  label: string
}

type FooterState = {
  keybindings: FooterKeybinding[]
  stack: FooterKeybinding[][]
  setKeybindings: (keybindings: FooterKeybinding[]) => void
  resetKeybindings: () => void
}

const DEFAULT_KEYBINDINGS: FooterKeybinding[] = [
  { keys: 'ctrl+k', label: 'commands' },
  { keys: 'q', label: 'quit' },
]

function withDefaults(custom: FooterKeybinding[]): FooterKeybinding[] {
  return [...custom, ...DEFAULT_KEYBINDINGS]
}

export const useFooter = create<FooterState>((set) => ({
  keybindings: DEFAULT_KEYBINDINGS,
  stack: [],
  setKeybindings(keybindings) {
    set((state) => {
      const stack = [...state.stack, keybindings]
      return { stack, keybindings: withDefaults(keybindings) }
    })
  },
  resetKeybindings() {
    set((state) => {
      const stack = state.stack.slice(0, -1)
      const top = stack[stack.length - 1] ?? []
      return { stack, keybindings: withDefaults(top) }
    })
  },
}))
