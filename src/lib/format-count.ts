/** Grouped integer for table cells and labels (en-US). */
export function formatCount(n: number): string {
  return Math.round(n).toLocaleString('en-US')
}
