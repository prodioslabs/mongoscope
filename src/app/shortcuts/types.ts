type ShortcutBinding = {
  key: string
  cmd: string
}

export type MnemonicSegment = {
  key: string
  text: string
}

export type Shortcut = {
  keys: string
  helpLabel: string
  footerLabel?: string
  footerKeys?: string
  helpSegments?: readonly MnemonicSegment[]
  bindings: ReadonlyArray<ShortcutBinding>
}

export type FooterChip = {
  keys: string
  label: string
  segments?: readonly MnemonicSegment[]
}

/** Alias of FooterChip for help-menu rows. */
export type HelpBinding = FooterChip

export type HelpSection = {
  title: string
  bindings: HelpBinding[]
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
      ...(shortcut.helpSegments != null ? { segments: shortcut.helpSegments } : {}),
    })),
  }
}

export function toBindings(shortcuts: ReadonlyArray<Shortcut>): ShortcutBinding[] {
  return shortcuts.flatMap((shortcut) => [...shortcut.bindings])
}
