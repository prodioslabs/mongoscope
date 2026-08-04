import { createCliRenderer } from '@opentui/core'
import { createRoot } from '@opentui/react'
import { App, type AppOptions } from './app'
import { ThemeProvider } from './components/theme-provider'
import './lib/opentui-text-table'

export type { AppOptions }

export async function start(options: AppOptions) {
  const renderer = await createCliRenderer()
  createRoot(renderer).render(
    <ThemeProvider mode="dark" theme="gruvbox">
      <App options={options} />
    </ThemeProvider>,
  )
}
