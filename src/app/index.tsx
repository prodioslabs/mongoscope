import { createCliRenderer } from '@opentui/core'
import { createDefaultOpenTuiKeymap } from '@opentui/keymap/opentui'
import { KeymapProvider } from '@opentui/keymap/react'
import { createRoot } from '@opentui/react'
import { App, type AppOptions } from './app'
import { QueryProvider } from './components/query-provider'
import { ThemeProvider } from './components/theme-provider'
import { type AppKeymapMode } from './lib/keymap-mode'
import './lib/opentui-text-table'

export type { AppOptions }

export async function start(options: AppOptions) {
  const renderer = await createCliRenderer()
  const keymap = createDefaultOpenTuiKeymap(renderer)

  keymap.registerLayerFields({
    appMode(value, ctx) {
      ctx.require('app.mode', value)
    },
  })
  keymap.setData('app.mode', 'base' satisfies AppKeymapMode)

  createRoot(renderer).render(
    <KeymapProvider keymap={keymap}>
      <ThemeProvider mode="dark" theme="gruvbox">
        <QueryProvider>
          <App options={options} />
        </QueryProvider>
      </ThemeProvider>
    </KeymapProvider>,
  )
}
