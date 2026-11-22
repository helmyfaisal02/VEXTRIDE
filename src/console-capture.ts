/** Bounded error metadata for authorized Arc Studio previews. Details stay in the local console. */
import { getStudioDiagnosticsOrigin } from './lib/studioDiagnostics'

const parentOrigin = import.meta.env.DEV ? getStudioDiagnosticsOrigin() : undefined
if (parentOrigin) captureConsole(parentOrigin)

function captureConsole(targetOrigin: string) {
  let windowStart = Date.now()
  let count = 0
  function report(level: 'warn' | 'error', message: string) {
    const timestamp = Date.now()
    if (timestamp - windowStart >= 1000) {
      windowStart = timestamp
      count = 0
    }
    if (count++ >= 100) return
    try {
      window.parent.postMessage({ type: 'studio-console-log', entry: { level, message, timestamp } }, targetOrigin)
    } catch { /* Logging must keep working even if the preview frame closes. */ }
  }

  for (const level of ['warn', 'error'] as const) {
    const original = console[level].bind(console)
    console[level] = (...args: unknown[]) => {
      original(...args)
      report(level, level === 'error' ? 'Browser console error' : 'Browser console warning')
    }
  }
  window.addEventListener('error', () => report('error', 'Uncaught browser error'))
  window.addEventListener('unhandledrejection', () => report('error', 'Unhandled browser promise rejection'))
}
