import { isUnauthorizedError } from '../live-ops/permissions'
import type { ProfilerPanelError } from './types'

export function isProfilerUnavailableOnMongos(error: unknown): boolean {
  if (error == null || typeof error !== 'object') {
    return false
  }
  const message =
    typeof (error as { message?: unknown }).message === 'string'
      ? (error as { message: string }).message.toLowerCase()
      : ''
  const codeName =
    typeof (error as { codeName?: unknown }).codeName === 'string'
      ? (error as { codeName: string }).codeName.toLowerCase()
      : ''
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
  if (error == null || typeof error !== 'object') {
    return false
  }
  const code = (error as { code?: unknown }).code
  const codeName = (error as { codeName?: unknown }).codeName
  if (code === 26 || codeName === 'NamespaceNotFound') {
    return true
  }
  const message =
    typeof (error as { message?: unknown }).message === 'string'
      ? (error as { message: string }).message.toLowerCase()
      : ''
  return message.includes('ns does not exist') || message.includes('namespace not found')
}
