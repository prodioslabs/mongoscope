import type { ExportFormat } from './types'
import { EXPORT_EXTENSIONS } from './types'

/**
 * When the path is still the default (untouched), swap the trailing extension for the
 * selected format. Once the user edits the path, leave it alone.
 */
export function syncPathExtension(
  path: string,
  format: ExportFormat,
  pathEdited: boolean,
): string {
  if (pathEdited) {
    return path
  }

  const nextExt = EXPORT_EXTENSIONS[format]
  const lastSlash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  const basenameStart = lastSlash + 1
  const basename = path.slice(basenameStart)
  const dir = path.slice(0, basenameStart)

  const lastDot = basename.lastIndexOf('.')
  if (lastDot <= 0) {
    return `${dir}${basename}.${nextExt}`
  }

  return `${dir}${basename.slice(0, lastDot)}.${nextExt}`
}
