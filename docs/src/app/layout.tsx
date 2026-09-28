import { RootProvider } from 'fumadocs-ui/provider/next'
import '../styles/globals.css'
import { Inter } from 'next/font/google'
import type { Metadata } from 'next'

const inter = Inter({
  subsets: ['latin'],
})

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || undefined

if (process.env.NODE_ENV === 'production' && !siteUrl) {
  console.warn('NEXT_PUBLIC_SITE_URL is unset; metadataBase falls back to http://localhost:3000')
}

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl ?? 'http://localhost:3000'),
}

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  )
}
