import { asDriverErrorLike } from '../lib/driver-error'
import { isUnauthorizedError } from '../lib/mongo-unauthorized-error'
import type { ProfilerPanelError } from './types'

export function isProfilerUnavailableOnMongos(error: unknown): boolean {
  const record = asDriverErrorLike(error)
  if (record == null) {
    return false
  }
  const message = typeof record.message === 'string' ? record.message.toLowerCase() : ''
  const codeName = typeof record.codeName === 'string' ? record.codeName.toLowerCase() : ''
  return (
    message.includes('mongos') ||
    (message.includes('profiling') && message.includes('not support')) ||
    message.includes('cannot set profile level') ||
    (codeName.includes('invalidoptions') && message.includes('profile'))
  )
}

export function statusErrorFromUnknown(error: unknown): ProfilerPanelError {
  if (isUnauthorizedError(error)) {
    return {
      kind: 'permission',
      message: 'cannot read profiling status (needs enableProfiler / dbAdmin)',
    }
  }
  if (isProfilerUnavailableOnMongos(error)) {
    return {
      kind: 'unavailable',
      message: 'profiler unavailable on mongos',
    }
  }
  return {
    kind: 'unknown',
    message: 'failed to read profiling status',
  }
}

export function readErrorFromUnknown(error: unknown): ProfilerPanelError {
  if (isUnauthorizedError(error)) {
    return {
      kind: 'permission',
      message: 'cannot read system.profile (needs find on system.profile / clusterMonitor)',
    }
  }
  if (isNamespaceMissing(error)) {
    return {
      kind: 'unknown',
      message: 'system.profile not found',
    }
  }
  return {
    kind: 'unknown',
    message: 'failed to read system.profile',
  }
}

export function enableErrorFromUnknown(error: unknown): ProfilerPanelError {
  if (isUnauthorizedError(error)) {
    return {
      kind: 'permission',
      message: 'cannot enable profiler (needs enableProfiler / dbAdmin)',
    }
  }
  if (isProfilerUnavailableOnMongos(error)) {
    return {
      kind: 'unavailable',
      message: 'profiler unavailable on mongos',
    }
  }
  return {
    kind: 'unknown',
    message: 'failed to enable profiler',
  }
}

export function databasesErrorFromUnknown(error: unknown): ProfilerPanelError {
  if (isUnauthorizedError(error)) {
    return {
      kind: 'permission',
      message: 'insufficient permissions to list databases',
    }
  }
  return {
    kind: 'unknown',
    message: 'failed to list databases',
  }
}

export function isNamespaceMissing(error: unknown): boolean {
  const record = asDriverErrorLike(error)
  if (record == null) {
    return false
  }
  if (record.code === 26 || record.codeName === 'NamespaceNotFound') {
    return true
  }
  const message = typeof record.message === 'string' ? record.message.toLowerCase() : ''
  return message.includes('ns does not exist') || message.includes('namespace not found')
}
