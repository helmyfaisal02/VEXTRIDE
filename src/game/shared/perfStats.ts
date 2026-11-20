/**
 * Tiny pub/sub for measured render stats. The render loop writes here and the
 * HUD mutates its own DOM node on update, so measuring never triggers a React
 * re-render.
 */
export interface PerfSample {
  /** Frames per second averaged over the last sampling window. */
  fps: number
  /** Average frame time in milliseconds over the same window. */
  frameMs: number
  drawCalls: number
  triangles: number
}

type Listener = (sample: PerfSample) => void

const listeners = new Set<Listener>()

export function publishPerf(sample: PerfSample): void {
  for (const listener of listeners) listener(sample)
}

export function subscribePerf(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
