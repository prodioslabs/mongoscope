export function isNodeErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error != null && 'code' in error
}

export function isFileNotFoundError(error: unknown): boolean {
  return isNodeErrnoException(error) && error.code === 'ENOENT'
}

export function isFsPermissionDeniedError(error: unknown): boolean {
  return isNodeErrnoException(error) && (error.code === 'EACCES' || error.code === 'EPERM')
}
