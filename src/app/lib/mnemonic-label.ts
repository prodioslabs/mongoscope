import { StyledText, TextAttributes, type TextChunk } from '@opentui/core'
import { type MnemonicSegment } from '../shortcuts/types'

const MNEMONIC_KEY = /^[a-zA-Z]$/

function plainChunk(text: string): TextChunk {
  return {
    __isChunk: true,
    text,
    attributes: 0,
  }
}

export function renderMnemonicLabel(label: string, key: string): StyledText {
  if (!MNEMONIC_KEY.test(key)) {
    return new StyledText([plainChunk(label)])
  }

  const matchIndex = label.toLowerCase().indexOf(key.toLowerCase())
  if (matchIndex === -1) {
    return new StyledText([plainChunk(label)])
  }

  const chunks: TextChunk[] = []
  const prefix = label.slice(0, matchIndex)
  const matched = label.slice(matchIndex, matchIndex + 1)
  const suffix = label.slice(matchIndex + 1)
  if (prefix.length > 0) {
    chunks.push(plainChunk(prefix))
  }
  chunks.push({
    __isChunk: true,
    text: matched,
    attributes: TextAttributes.UNDERLINE,
  })
  if (suffix.length > 0) {
    chunks.push(plainChunk(suffix))
  }
  return new StyledText(chunks)
}

export function renderMnemonicSegments(segments: readonly MnemonicSegment[]): StyledText {
  const chunks: TextChunk[] = []
  for (const segment of segments) {
    chunks.push(...renderMnemonicLabel(segment.text, segment.key).chunks)
  }
  if (chunks.length === 0) {
    return new StyledText([plainChunk('')])
  }
  return new StyledText(chunks)
}
