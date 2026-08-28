const MONGODB_URI_PATTERN = /mongodb(?:\+srv)?:\/\/[^\s'"`]+/gi
/** user:pass@host — catch credential userinfo even when scheme was stripped */
const USERINFO_AT_HOST_PATTERN = /\b[^/\s:'"`]+:[^/\s@'"`]+@[^\s'"`/]+/g

/**
 * Strip MongoDB URIs and embedded credentials from driver/system error text
 * before anything reaches logs or the TUI.
 */
export function redactConnectionSecrets(text: string): string {
  return text
    .replace(MONGODB_URI_PATTERN, '[redacted-uri]')
    .replace(USERINFO_AT_HOST_PATTERN, '[redacted-credentials]@[redacted-host]')
}
