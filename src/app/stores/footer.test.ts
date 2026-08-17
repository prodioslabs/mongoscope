import { afterEach, describe, expect, it } from 'vitest'
import { useFooter } from './footer'

afterEach(function resetFooterStore() {
  useFooter.setState({
    keybindings: [
      { keys: 'ctrl+k', label: 'commands' },
      { keys: 'q', label: 'quit' },
    ],
    scopes: [],
    overlays: [],
    status: null,
    statusScopes: [],
  })
})

describe('footer overlay stack', () => {
  it('shows the top overlay and restores the previous one when it pops', () => {
    const { pushOverlayKeybindings, popOverlayKeybindings } = useFooter.getState()

    pushOverlayKeybindings('query-detail', [{ keys: 'enter', label: 'details' }])
    pushOverlayKeybindings('command-palette', [{ keys: 'enter', label: 'select' }])

    expect(useFooter.getState().keybindings[0]).toEqual({ keys: 'enter', label: 'select' })

    popOverlayKeybindings('command-palette')

    expect(useFooter.getState().keybindings[0]).toEqual({ keys: 'enter', label: 'details' })
  })

  it('updates an existing overlay in place so a lower overlay does not jump to the top', () => {
    const { pushOverlayKeybindings } = useFooter.getState()

    pushOverlayKeybindings('query-detail', [{ keys: 'r', label: 'raw' }])
    pushOverlayKeybindings('command-palette', [{ keys: 'enter', label: 'select' }])
    pushOverlayKeybindings('query-detail', [{ keys: 'r', label: 'curated' }])

    expect(useFooter.getState().keybindings[0]).toEqual({ keys: 'enter', label: 'select' })
    expect(useFooter.getState().overlays[0]).toEqual({
      id: 'query-detail',
      bindings: [{ keys: 'r', label: 'curated' }],
    })
  })
})
