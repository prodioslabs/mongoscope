import { TextAttributes, type StyledText } from '@opentui/core'
import { describe, expect, it } from 'vitest'
import { renderMnemonicLabel, renderMnemonicSegments } from './mnemonic-label'

function visibleText(styled: StyledText): string {
  return styled.chunks.map((chunk) => chunk.text).join('')
}

function underlinedLetters(styled: StyledText): string[] {
  return styled.chunks
    .filter((chunk) => chunk.attributes === TextAttributes.UNDERLINE)
    .map((chunk) => chunk.text)
}

describe('renderMnemonicLabel', () => {
  it('underlines the first case-insensitive letter and keeps the label character', () => {
    const styled = renderMnemonicLabel('connections', 'C')
    expect(visibleText(styled)).toBe('connections')
    expect(styled.chunks.map((chunk) => chunk.text)).toEqual(['c', 'onnections'])
    expect(styled.chunks[0]?.attributes).toBe(TextAttributes.UNDERLINE)
    expect(styled.chunks[0]?.fg).toBeUndefined()
    expect(styled.chunks[1]?.attributes).toBe(0)
    expect(visibleText(styled).includes('_')).toBe(false)

    const quit = renderMnemonicLabel('Quit', 'q')
    expect(visibleText(quit)).toBe('Quit')
    expect(quit.chunks[0]?.text).toBe('Q')
    expect(quit.chunks[0]?.attributes).toBe(TextAttributes.UNDERLINE)
  })

  it('returns one plain chunk when the letter is not in the label', () => {
    const styled = renderMnemonicLabel('samples', 'T')
    expect(styled.chunks).toEqual([{ __isChunk: true, text: 'samples', attributes: 0 }])
    expect(styled.chunks[0]?.fg).toBeUndefined()
  })

  it('returns the label unchanged for non-letter and multi-character keys', () => {
    const label = 'navigate'
    const keys = ['↑', '↑↓/jk', 'ctrl+k', 'enter', 'esc', 'tab', 'space', '1-5', 'shift+t', 'c/a/p']
    for (const key of keys) {
      const styled = renderMnemonicLabel(label, key)
      expect(styled.chunks).toEqual([{ __isChunk: true, text: label, attributes: 0 }])
    }
  })
})

describe('renderMnemonicSegments', () => {
  it('concatenates segments into the visible label and underlines only the intended letters', () => {
    const sortModes = renderMnemonicSegments([
      { key: '', text: 'sort ' },
      { key: 'c', text: 'count' },
      { key: '', text: '/' },
      { key: 'a', text: 'avg' },
      { key: '', text: '/' },
      { key: 'p', text: 'plan' },
    ])
    expect(visibleText(sortModes)).toBe('sort count/avg/plan')
    expect(underlinedLetters(sortModes)).toEqual(['c', 'a', 'p'])
    expect(visibleText(sortModes).includes('_')).toBe(false)

    const sizeOps = renderMnemonicSegments([
      { key: '', text: 'sort ' },
      { key: 's', text: 'size' },
      { key: '', text: '/' },
      { key: 'o', text: 'ops' },
    ])
    expect(visibleText(sizeOps)).toBe('sort size/ops')
    expect(underlinedLetters(sizeOps)).toEqual(['s', 'o'])
    expect(sizeOps.chunks[0]).toMatchObject({ text: 'sort ', attributes: 0 })
  })
})
