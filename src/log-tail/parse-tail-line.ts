import { isRecord } from '../lib/is-record'
import { parseMongoLogTimestampMs } from '../lib/mongo-log-timestamp'
import { encodeSeverity, scanHotFields, severityLabel, SEVERITY_RAW } from '../parser'
import { extractLogLineAttrFields } from './attr-fields'
import type { TailLogLine } from './types'

const TEXT_ENCODER = new TextEncoder()

/** Shared by file-tail byte ingest and getLog string ingest. */
export function parseTailLogLineFromText(text: string): TailLogLine {
  if (text.length === 0) {
    return rawLine('', Number.NaN)
  }

  const bytes = TEXT_ENCODER.encode(text)
  const hot = scanHotFields(bytes, 0, bytes.length)
  if (hot != null) {
    const attr = tryExtractAttr(text)
    return {
      timestamp: hot.timestamp,
      severity: hot.severity,
      severityLabel: severityLabel(hot.severity),
      component: hot.component,
      id: hot.id,
      ctx: hot.ctx,
      msg: hot.msg,
      namespace: attr.namespace,
      durationMillis: attr.durationMillis,
      planSummary: attr.planSummary,
      kind: 'json',
    }
  }

  try {
    const parsed: unknown = JSON.parse(text)
    if (isRecord(parsed)) {
      const obj = parsed
      if (typeof obj.s === 'string' && typeof obj.c === 'string' && typeof obj.msg === 'string') {
        const attr = extractLogLineAttrFields(obj.attr)
        const severity = encodeSeverity(obj.s)
        return {
          timestamp: parseTimestampLoose(obj.t),
          severity,
          severityLabel: severityLabel(severity),
          component: obj.c,
          id: typeof obj.id === 'number' ? obj.id >>> 0 : 0,
          ctx: typeof obj.ctx === 'string' ? obj.ctx : '',
          msg: obj.msg,
          namespace: attr.namespace,
          durationMillis: attr.durationMillis,
          planSummary: attr.planSummary,
          kind: 'json',
        }
      }
    }
  } catch {
    // fall through to raw
  }

  return rawLine(text, Number.NaN)
}

function tryExtractAttr(text: string): ReturnType<typeof extractLogLineAttrFields> {
  try {
    const parsed: unknown = JSON.parse(text)
    if (isRecord(parsed) && 'attr' in parsed) {
      return extractLogLineAttrFields(parsed.attr)
    }
  } catch {
    // ignore
  }
  return { namespace: null, durationMillis: null, planSummary: null }
}

function rawLine(text: string, timestamp: number): TailLogLine {
  return {
    timestamp,
    severity: SEVERITY_RAW,
    severityLabel: '',
    component: '',
    id: 0,
    ctx: '',
    msg: text,
    namespace: null,
    durationMillis: null,
    planSummary: null,
    kind: 'raw',
  }
}

function parseTimestampLoose(t: unknown): number {
  return parseMongoLogTimestampMs(t) ?? Number.NaN
}
