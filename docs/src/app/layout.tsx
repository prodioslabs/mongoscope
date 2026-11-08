import { RootProvider } from 'fumadocs-ui/provider/next'
import '../styles/globals.css'
import { Inter, JetBrains_Mono } from 'next/font/google'
import type { Metadata } from 'next'
import { appName, siteDescription } from '@/lib/shared'

const inter = Inter({
  subsets: ['latin'],
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
})

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
    <html
      lang="en"
      className={`${inter.className} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="flex flex-col min-h-screen" suppressHydrationWarning>
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  )
}
