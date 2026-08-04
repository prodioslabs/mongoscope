import { createContext, useContext, useEffect, useId, type ReactNode } from 'react'
import { useFooter, type FooterKeybinding } from './footer'

const FooterPathContext = createContext('')

type FooterKeybindingScopeProps = {
  bindings: FooterKeybinding[]
  status?: string | null
  children?: ReactNode
}

export function FooterKeybindingScope({
  bindings,
  status,
  children,
}: FooterKeybindingScopeProps) {
  const path = useFooterPath()

  return (
    <FooterPathContext.Provider value={path}>
      <FooterKeybindingContributor path={path} bindings={bindings} />
      {status !== undefined ? <FooterStatusContributor path={path} status={status} /> : null}
      {children}
    </FooterPathContext.Provider>
  )
}

/** Contribute keybindings for a leaf that does not need to wrap children. */
export function useFooterKeybindings(bindings: FooterKeybinding[]) {
  const path = useFooterPath()
  useContributeKeybindings(path, bindings)
}

/** Contribute mid-footer status for a leaf that does not need to wrap children. */
export function useFooterStatus(status: string | null) {
  const path = useFooterPath()
  useContributeStatus(path, status)
}

function useFooterPath(): string {
  const parentPath = useContext(FooterPathContext)
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

type FooterStatusContributorProps = {
  path: string
  status: string | null
}

function FooterStatusContributor({ path, status }: FooterStatusContributorProps) {
  useContributeStatus(path, status)
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

function useContributeStatus(path: string, status: string | null) {
  const contributeStatus = useFooter((s) => s.contributeStatus)
  const withdrawStatus = useFooter((s) => s.withdrawStatus)

  useEffect(
    function syncFooterStatusScope() {
      contributeStatus(path, status)
      return function withdrawFooterStatusScope() {
        withdrawStatus(path)
      }
    },
    [path, status, contributeStatus, withdrawStatus],
  )
}
