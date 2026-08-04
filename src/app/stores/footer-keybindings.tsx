import { createContext, useContext, useEffect, useId, type ReactNode } from 'react'
import { useFooter, type FooterKeybinding } from './footer'

const FooterKeybindingPathContext = createContext('')

type FooterKeybindingScopeProps = {
  bindings: FooterKeybinding[]
  children?: ReactNode
}

export function FooterKeybindingScope({ bindings, children }: FooterKeybindingScopeProps) {
  const path = useFooterKeybindingPath()

  return (
    <FooterKeybindingPathContext.Provider value={path}>
      <FooterKeybindingContributor path={path} bindings={bindings} />
      {children}
    </FooterKeybindingPathContext.Provider>
  )
}

/** Contribute keybindings for a leaf that does not need to wrap children. */
export function useFooterKeybindings(bindings: FooterKeybinding[]) {
  const path = useFooterKeybindingPath()
  useContributeKeybindings(path, bindings)
}

function useFooterKeybindingPath(): string {
  const parentPath = useContext(FooterKeybindingPathContext)
  const id = useId()
  return `${parentPath}/${id}`
}

type FooterKeybindingContributorProps = {
  path: string
  bindings: FooterKeybinding[]
}

function FooterKeybindingContributor({ path, bindings }: FooterKeybindingContributorProps) {
  useContributeKeybindings(path, bindings)
  return null
}

function useContributeKeybindings(path: string, bindings: FooterKeybinding[]) {
  const contributeKeybindings = useFooter((s) => s.contributeKeybindings)
  const withdrawKeybindings = useFooter((s) => s.withdrawKeybindings)

  useEffect(
    function syncFooterKeybindingScope() {
      contributeKeybindings(path, bindings)
      return function withdrawFooterKeybindingScope() {
        withdrawKeybindings(path)
      }
    },
    [path, bindings, contributeKeybindings, withdrawKeybindings],
  )
}
