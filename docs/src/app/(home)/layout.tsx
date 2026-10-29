import { HomeLayout } from 'fumadocs-ui/layouts/home'
import type { Metadata } from 'next'
import { baseOptions } from '@/lib/layout.shared'
import { appName } from '@/lib/shared'

export const metadata: Metadata = {
  title: {
    absolute: appName,
  },
}

export default function Layout({ children }: LayoutProps<'/'>) {
  return <HomeLayout {...baseOptions()}>{children}</HomeLayout>
}
