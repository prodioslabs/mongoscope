import { create } from 'zustand'

export type FooterKeybinding = {
  keys: string
  label: string
}

type FooterState = {
  keybindings: FooterKeybinding[]
  stack: FooterKeybinding[][]
  /** Optional mid-footer status (e.g. log path + parse time) */
  status: string | null
  setKeybindings: (keybindings: FooterKeybinding[]) => void
  resetKeybindings: () => void
  setStatus: (status: string | null) => void
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
  status: null,
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
  setStatus(status) {
    set({ status })
  },
}))
