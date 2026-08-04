import { create } from 'zustand'

export type FooterKeybinding = {
  keys: string
  label: string
}

type FooterScope = {
  path: string
  bindings: FooterKeybinding[]
}

type FooterState = {
  keybindings: FooterKeybinding[]
  scopes: FooterScope[]
  overlay: FooterKeybinding[] | null
  /** Optional mid-footer status (e.g. log path + parse time) */
  status: string | null
  contributeKeybindings: (path: string, bindings: FooterKeybinding[]) => void
  withdrawKeybindings: (path: string) => void
  setOverlayKeybindings: (bindings: FooterKeybinding[] | null) => void
  setStatus: (status: string | null) => void
}

const DEFAULT_KEYBINDINGS: FooterKeybinding[] = [
  { keys: 'ctrl+k', label: 'commands' },
  { keys: 'q', label: 'quit' },
]

function withDefaults(custom: FooterKeybinding[]): FooterKeybinding[] {
  return [...custom, ...DEFAULT_KEYBINDINGS]
}

function flattenScopes(scopes: FooterScope[]): FooterKeybinding[] {
  return scopes.flatMap((scope) => scope.bindings)
}

function deriveKeybindings(
  scopes: FooterScope[],
  overlay: FooterKeybinding[] | null,
): FooterKeybinding[] {
  if (overlay != null) {
    return withDefaults(overlay)
  }
  return withDefaults(flattenScopes(scopes))
}

function sortScopes(scopes: FooterScope[]): FooterScope[] {
  return scopes.slice().sort(function compareScopePaths(a, b) {
    return a.path.localeCompare(b.path)
  })
}

export const useFooter = create<FooterState>((set) => ({
  keybindings: DEFAULT_KEYBINDINGS,
  scopes: [],
  overlay: null,
  status: null,
  contributeKeybindings(path, bindings) {
    set((state) => {
      const without = state.scopes.filter((scope) => scope.path !== path)
      const scopes = sortScopes([...without, { path, bindings }])
      return { scopes, keybindings: deriveKeybindings(scopes, state.overlay) }
    })
  },
  withdrawKeybindings(path) {
    set((state) => {
      const prefix = `${path}/`
      const scopes = state.scopes.filter(
        (scope) => scope.path !== path && !scope.path.startsWith(prefix),
      )
      return { scopes, keybindings: deriveKeybindings(scopes, state.overlay) }
    })
  },
  setOverlayKeybindings(bindings) {
    set((state) => ({
      overlay: bindings,
      keybindings: deriveKeybindings(state.scopes, bindings),
    }))
  },
  setStatus(status) {
    set({ status })
  },
}))
