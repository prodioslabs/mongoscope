/**
 * Map a filesystem write failure to a short user-facing message.
 * Never pass through raw errno text.
 */
export function mapWriteError(error: unknown): string {
  if (isNodeErrnoException(error)) {
    if (error.code === 'EACCES' || error.code === 'EPERM') {
      return 'permission denied'
    }
    if (error.code === 'ENOENT') {
      return 'directory missing'
    }
    if (error.code === 'ENOSPC') {
      return 'disk full'
    }
    if (error.code === 'EISDIR') {
      return 'path is a directory'
    }
  }
  return 'could not write file'
}

function isNodeErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error != null && 'code' in error
}
