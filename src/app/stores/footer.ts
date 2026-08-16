import { create } from 'zustand'
import { GLOBAL_FOOTER_SHORTCUTS } from '../shortcuts/global'
import { toFooter } from '../shortcuts/types'

export type FooterKeybinding = {
  keys: string
  label: string
}

type FooterKeybindingScope = {
  path: string
  bindings: FooterKeybinding[]
}

type FooterStatusScope = {
  path: string
  status: string | null
}

type FooterState = {
  keybindings: FooterKeybinding[]
  scopes: FooterKeybindingScope[]
  overlay: FooterKeybinding[] | null
  /** Optional mid-footer status (e.g. log path + parse time) */
  status: string | null
  statusScopes: FooterStatusScope[]
  contributeKeybindings: (path: string, bindings: FooterKeybinding[]) => void
  withdrawKeybindings: (path: string) => void
  setOverlayKeybindings: (bindings: FooterKeybinding[] | null) => void
  contributeStatus: (path: string, status: string | null) => void
  withdrawStatus: (path: string) => void
}

const DEFAULT_KEYBINDINGS: FooterKeybinding[] = toFooter(GLOBAL_FOOTER_SHORTCUTS)

function withDefaults(custom: FooterKeybinding[]): FooterKeybinding[] {
  return [...custom, ...DEFAULT_KEYBINDINGS]
}

function flattenScopes(scopes: FooterKeybindingScope[]): FooterKeybinding[] {
  return scopes.flatMap((scope) => scope.bindings)
}

function deriveKeybindings(
  scopes: FooterKeybindingScope[],
  overlay: FooterKeybinding[] | null,
): FooterKeybinding[] {
  if (overlay != null) {
    return overlay
  }
  return withDefaults(flattenScopes(scopes))
}

function deriveStatus(statusScopes: FooterStatusScope[]): string | null {
  const parts: string[] = []
  for (const scope of statusScopes) {
    if (scope.status != null) {
      parts.push(scope.status)
    }
  }
  return parts.length > 0 ? parts.join(' · ') : null
}

function sortByPath<T extends { path: string }>(items: T[]): T[] {
  return items.slice().sort(function comparePaths(a, b) {
    return a.path.localeCompare(b.path)
  })
}

function withoutPathAndDescendants<T extends { path: string }>(items: T[], path: string): T[] {
  const prefix = `${path}/`
  return items.filter((item) => item.path !== path && !item.path.startsWith(prefix))
}

export const useFooter = create<FooterState>((set) => ({
  keybindings: DEFAULT_KEYBINDINGS,
  scopes: [],
  overlay: null,
  status: null,
  statusScopes: [],
  contributeKeybindings(path, bindings) {
    set((state) => {
      const without = state.scopes.filter((scope) => scope.path !== path)
      const scopes = sortByPath([...without, { path, bindings }])
      return { scopes, keybindings: deriveKeybindings(scopes, state.overlay) }
    })
  },
  withdrawKeybindings(path) {
    set((state) => {
      const scopes = withoutPathAndDescendants(state.scopes, path)
      return { scopes, keybindings: deriveKeybindings(scopes, state.overlay) }
    })
  },
  setOverlayKeybindings(bindings) {
    set((state) => ({
      overlay: bindings,
      keybindings: deriveKeybindings(state.scopes, bindings),
    }))
  },
  contributeStatus(path, status) {
    set((state) => {
      const without = state.statusScopes.filter((scope) => scope.path !== path)
      const statusScopes = sortByPath([...without, { path, status }])
      return { statusScopes, status: deriveStatus(statusScopes) }
    })
  },
  withdrawStatus(path) {
    set((state) => {
      const statusScopes = withoutPathAndDescendants(state.statusScopes, path)
      return { statusScopes, status: deriveStatus(statusScopes) }
    })
  },
}))
