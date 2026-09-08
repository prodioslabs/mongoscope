import { type TextTableContent } from '@opentui/core'
import { type Theme } from '../../theme'
import '../../lib/opentui-text-table'

type DataTextTableProps = {
  content: TextTableContent
  theme: Theme
}

export function DataTextTable({ content, theme }: DataTextTableProps) {
  return (
    <textTable
      content={content}
      flexGrow={1}
      border
      outerBorder
      borderStyle="single"
      borderColor={theme.border}
      wrapMode="none"
      cellPaddingX={0}
      selectable={false}
      height="100%"
      width="100%"
    />
  )
}
