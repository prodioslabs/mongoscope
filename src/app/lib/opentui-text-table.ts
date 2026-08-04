import { TextTableRenderable } from '@opentui/core'
import { extend } from '@opentui/react'

declare module '@opentui/react' {
  interface OpenTUIComponents {
    textTable: typeof TextTableRenderable
  }
}

extend({ textTable: TextTableRenderable })
