export type ShortcutBinding = {
  key: string
  cmd: string
}

export type Shortcut = {
  keys: string
  helpLabel: string
  footerLabel?: string
  footerKeys?: string
  bindings: ReadonlyArray<ShortcutBinding>
}

export type HelpBinding = {
  keys: string
  label: string
}

export type HelpSection = {
  title: string
  bindings: HelpBinding[]
}

export type FooterChip = {
  keys: string
  label: string
}

export function toFooter(shortcuts: ReadonlyArray<Shortcut>): FooterChip[] {
  const result: FooterChip[] = []
  for (const shortcut of shortcuts) {
    if (shortcut.footerLabel == null) continue
    result.push({
      keys: shortcut.footerKeys ?? shortcut.keys,
      label: shortcut.footerLabel,
    })
  }
  return result
}

export function toHelpSection(title: string, shortcuts: ReadonlyArray<Shortcut>): HelpSection {
  return {
    title,
    bindings: shortcuts.map((shortcut) => ({
      keys: shortcut.keys,
      label: shortcut.helpLabel,
    })),
  }
}

export function toBindings(shortcuts: ReadonlyArray<Shortcut>): ShortcutBinding[] {
  return shortcuts.flatMap((shortcut) => [...shortcut.bindings])
}
