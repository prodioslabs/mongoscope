import { RootProvider } from 'fumadocs-ui/provider/next'
import '../styles/globals.css'
import type { Metadata } from 'next'
import { appName, siteDescription } from '@/lib/shared'

// No webfonts: body and code use system stacks (see globals.css). A webfont download and its
// fallback-face lookups sat in front of the hero paint on mobile Lighthouse.

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || undefined

if (process.env.NODE_ENV === 'production' && !siteUrl) {
  console.warn('NEXT_PUBLIC_SITE_URL is unset; metadataBase falls back to http://localhost:3000')
}

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl ?? 'http://localhost:3000'),
  applicationName: appName,
  title: {
    default: appName,
    template: `%s | ${appName}`,
  },
  description: siteDescription,
}

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex flex-col min-h-screen" suppressHydrationWarning>
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  )
}
