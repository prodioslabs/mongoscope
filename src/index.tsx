import { createCliRenderer } from '@opentui/core'
import { createRoot } from '@opentui/react'
import { App } from './app'
import { ThemeProvider } from './components/theme-provider'

const renderer = await createCliRenderer()
createRoot(renderer).render(
  <ThemeProvider mode="dark" theme="gruvbox">
    <App />
  </ThemeProvider>,
)
