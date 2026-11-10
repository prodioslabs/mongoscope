import { HomeLayout } from 'fumadocs-ui/layouts/home'
import type { Metadata } from 'next'
import { baseOptions } from '@/lib/layout.shared'
import { releasesUrl, siteDescription, siteTitle } from '@/lib/shared'

export const metadata: Metadata = {
  title: {
    absolute: siteTitle,
  },
  description: siteDescription,
}

export default function Layout({ children }: LayoutProps<'/'>) {
  const base = baseOptions()

  // Home-only links; the shared options also feed the docs sidebar.
  return (
    <HomeLayout
      {...base}
      links={[
        ...(base.links ?? []),
        { text: 'Features', url: '/#features', active: 'none' },
        { text: 'Shortcuts', url: '/#shortcuts', active: 'none' },
        { text: 'Changelog', url: releasesUrl, external: true },
      ]}
    >
      {children}
    </HomeLayout>
  )
}
