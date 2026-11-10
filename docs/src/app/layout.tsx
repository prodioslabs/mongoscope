import { RootProvider } from 'fumadocs-ui/provider/next'
import '../styles/globals.css'
import type { Metadata } from 'next'
import { appName, siteDescription, siteTitle, siteUrl } from '@/lib/shared'

// No webfonts: body and code use system stacks (see globals.css). A webfont download and its
// fallback-face lookups sat in front of the hero paint on mobile Lighthouse.

if (process.env.NODE_ENV === 'production' && !process.env.NEXT_PUBLIC_SITE_URL) {
  console.warn(`NEXT_PUBLIC_SITE_URL is unset; metadataBase falls back to ${siteUrl}`)
}

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: appName,
  title: {
    default: siteTitle,
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
