/** Arc Studio preview diagnostics. Wallet/provider calls and payloads stay local. */
import { getStudioDiagnosticsOrigin } from './lib/studioDiagnostics'

const parentOrigin = import.meta.env.DEV ? getStudioDiagnosticsOrigin() : undefined
const httpMethods = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'])
const chains = new Map<string, number>()
const arcRpcOrigin = 'https://rpc.mainnet.arc.io'

export function registerChain(chainId: number, rpcUrl: string): void {
  if (parentOrigin) chains.set(new URL(rpcUrl).origin, chainId)
}

if (parentOrigin) {
  let enabled = false
  let counter = 0
  const groups: { id: string; label: string }[] = []
  const id = () => 'preview-' + ++counter
  const emit = (event: object) => {
    try {
      window.parent.postMessage({ type: 'studio-trace-event', event }, parentOrigin)
    } catch { /* Preview diagnostics must never affect an application request. */ }
  }
  window.addEventListener('message', (event: MessageEvent<{ type?: string; enabled?: boolean }>) => {
    if (event.source === window.parent && event.origin === parentOrigin && event.data?.type === 'studio-trace-config') {
      enabled = event.data.enabled === true
    }
  })

  // Keep the preview's group API without forwarding arbitrary labels.
  Object.assign(window, { __studioTrace: {
    startGroup() {
      const groupId = id(), timestamp = Date.now()
      const parents = groups.slice()
      groups.push({ id: groupId, label: 'Preview task' })
      if (enabled) emit({ kind: 'group-start', id: id(), timestamp, groupId, label: 'Preview task', groups: parents })
      return groupId
    },
    endGroup() {
      const entry = groups.pop()
      if (enabled && entry) emit({ kind: 'group-end', id: id(), timestamp: Date.now(), groupId: entry.id, groups })
    },
  } })

  const fetch = globalThis.fetch.bind(globalThis)
  globalThis.fetch = async (input, init) => {
    if (!enabled) return fetch(input, init)
    const request = input instanceof Request ? input : undefined
    let origin: string
    try {
      origin = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, window.location.origin).origin
    } catch {
      return fetch(input, init)
    }
    if (origin === arcRpcOrigin) return fetch(input, init)
    const method = (init?.method ?? request?.method ?? 'GET').toUpperCase()
    const timestamp = Date.now()
    let status = 0
    try {
      const response = await fetch(input, init)
      status = response.status
      return response
    } finally {
      if (enabled) emit({
        kind: 'http', id: id(), timestamp, method: httpMethods.has(method) ? method : 'OTHER',
        url: origin === window.location.origin ? origin : '(external request)',
        chainId: chains.get(origin) ?? 0, status, duration: Date.now() - timestamp, groups,
      })
    }
  }
}
