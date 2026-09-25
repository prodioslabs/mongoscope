export function truncateText(value: string, maxLen: number): string {
  if (value.length <= maxLen) {
    return value
  }
  if (maxLen <= 1) {
    return '…'
  }
  return `${value.slice(0, maxLen - 1)}…`
}
