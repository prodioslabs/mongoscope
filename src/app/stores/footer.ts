import { create } from 'zustand'
import { GLOBAL_FOOTER_SHORTCUTS } from '../shortcuts/global'
import { toFooter, type FooterChip } from '../shortcuts/types'

export type FooterKeybinding = FooterChip

type FooterKeybindingScope = {
  path: string
  bindings: FooterKeybinding[]
}

type FooterOverlay = {
  id: string
  bindings: FooterKeybinding[]
}

type FooterStatusScope = {
  path: string
  status: string | null
}

type FooterState = {
  keybindings: FooterKeybinding[]
  scopes: FooterKeybindingScope[]
  overlays: FooterOverlay[]
  /** Optional mid-footer status (e.g. log path + parse time) */
  status: string | null
  statusScopes: FooterStatusScope[]
  contributeKeybindings: (path: string, bindings: FooterKeybinding[]) => void
  withdrawKeybindings: (path: string) => void
  pushOverlayKeybindings: (id: string, bindings: FooterKeybinding[]) => void
  popOverlayKeybindings: (id: string) => void
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

function topOverlayBindings(overlays: FooterOverlay[]): FooterKeybinding[] | null {
  return overlays.at(-1)?.bindings ?? null
}

function deriveKeybindings(
  scopes: FooterKeybindingScope[],
  overlays: FooterOverlay[],
): FooterKeybinding[] {
  const overlay = topOverlayBindings(overlays)
  if (overlay != null) {
    return overlay
  }
  return withDefaults(flattenScopes(scopes))
}

function upsertOverlay(
  overlays: FooterOverlay[],
  id: string,
  bindings: FooterKeybinding[],
): FooterOverlay[] {
  const index = overlays.findIndex((overlay) => overlay.id === id)
  if (index === -1) {
    return [...overlays, { id, bindings }]
  }
  const next = overlays.slice()
  next[index] = { id, bindings }
  return next
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
  overlays: [],
  status: null,
  statusScopes: [],
  contributeKeybindings(path, bindings) {
    set((state) => {
      const without = state.scopes.filter((scope) => scope.path !== path)
      const scopes = sortByPath([...without, { path, bindings }])
      return { scopes, keybindings: deriveKeybindings(scopes, state.overlays) }
    })
  },
  withdrawKeybindings(path) {
    set((state) => {
      const scopes = withoutPathAndDescendants(state.scopes, path)
      return { scopes, keybindings: deriveKeybindings(scopes, state.overlays) }
    })
  },
  pushOverlayKeybindings(id, bindings) {
    set((state) => {
      const overlays = upsertOverlay(state.overlays, id, bindings)
      return { overlays, keybindings: deriveKeybindings(state.scopes, overlays) }
    })
  },
  popOverlayKeybindings(id) {
    set((state) => {
      const overlays = state.overlays.filter((overlay) => overlay.id !== id)
      return { overlays, keybindings: deriveKeybindings(state.scopes, overlays) }
    })
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
