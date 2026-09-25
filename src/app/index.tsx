import { createCliRenderer } from '@opentui/core'
import { createDefaultOpenTuiKeymap } from '@opentui/keymap/opentui'
import { KeymapProvider } from '@opentui/keymap/react'
import { createRoot } from '@opentui/react'
import { App, type AppOptions } from './app'
import { QueryProvider } from './components/query-provider'
import { ThemeProvider } from './components/theme-provider'
import { loadAppConfig } from './config/app-config'
import { DEFAULT_APP_CONFIG, DEFAULT_THEME_NAME, type ThemeMode } from './config/types'
import { type AppKeymapMode } from './lib/keymap-mode'
import { overlayMode } from './lib/overlay-mode'
import './lib/opentui-text-table'
import { enableThemeConfigPersistence, useTheme } from './stores/theme'
import { refreshThemeCatalog, resolveConfiguredThemeName } from './theme/catalog'

export type { AppOptions }

type BootstrappedTheme = {
  theme: string
  mode: ThemeMode
}

/**
 * Resolve theme before first React paint (config + catalog only; no providers yet).
 */
async function bootstrapThemeSelection(): Promise<BootstrappedTheme> {
  try {
    const appConfig = await loadAppConfig()
    const catalog = await refreshThemeCatalog()
    const selectedTheme = resolveConfiguredThemeName(catalog, appConfig.theme)
    useTheme.getState().hydrate({ theme: selectedTheme, mode: appConfig.mode })
    enableThemeConfigPersistence()
    return { theme: selectedTheme, mode: appConfig.mode }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    // oxlint-disable-next-line no-console -- OpenTUI console overlay; boot fallback
    console.warn(`Theme bootstrap failed; falling back to ${DEFAULT_THEME_NAME}: ${message}`)
    useTheme.getState().hydrate({
      theme: DEFAULT_THEME_NAME,
      mode: DEFAULT_APP_CONFIG.mode,
    })
    // Persistence left disabled so a broken bootstrap cannot write config.json.
    return { theme: DEFAULT_THEME_NAME, mode: DEFAULT_APP_CONFIG.mode }
  }
}

export async function start(options: AppOptions) {
  const { theme: selectedTheme, mode } = await bootstrapThemeSelection()

  const renderer = await createCliRenderer()
  const keymap = createDefaultOpenTuiKeymap(renderer)

  keymap.registerLayerFields({
    appMode(value, ctx) {
      ctx.require('app.mode', value)
    },
  })
  keymap.setData('app.mode', 'base' satisfies AppKeymapMode)
  // Clear any leaked overlay holds from a previous HMR cycle so base keys (1–5 tabs) work.
  overlayMode.clear(keymap)

  createRoot(renderer).render(
    <KeymapProvider keymap={keymap}>
      <ThemeProvider mode={mode} theme={selectedTheme}>
        <QueryProvider>
          <App options={options} />
        </QueryProvider>
      </ThemeProvider>
    </KeymapProvider>,
  )
}
