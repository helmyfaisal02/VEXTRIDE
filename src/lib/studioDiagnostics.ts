import { isStudioOrigin } from './share'

/** Never send diagnostics to an arbitrary embedder or an opaque origin. */
export function studioDiagnosticsOrigin(
  framed: boolean,
  ancestor?: string,
  referrer = '',
): string | undefined {
  if (!framed) return undefined
  if (ancestor !== undefined) return isStudioOrigin(ancestor) ? ancestor : undefined
  try {
    const origin = new URL(referrer).origin
    return isStudioOrigin(origin) ? origin : undefined
  } catch {
    return undefined
  }
}

export function getStudioDiagnosticsOrigin(): string | undefined {
  return studioDiagnosticsOrigin(window.parent !== window, window.location.ancestorOrigins?.[0], document.referrer)
}
