import {
  isFileNotFoundError,
  isFsPermissionDeniedError,
  isNodeErrnoException,
} from './node-errno'

/** User-facing write failure text — never pass through raw errno strings. */
export function mapWriteError(error: unknown): string {
  if (isFsPermissionDeniedError(error)) {
    return 'permission denied'
  }
  if (isFileNotFoundError(error)) {
    return 'directory missing'
  }
  if (isNodeErrnoException(error)) {
    if (error.code === 'ENOSPC') {
      return 'disk full'
    }
    if (error.code === 'EISDIR') {
      return 'path is a directory'
    }
  }
  return 'could not write file'
}
