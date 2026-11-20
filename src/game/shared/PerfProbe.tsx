import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { publishPerf } from './perfStats'

const WINDOW_MS = 500

/**
 * Measures real frame rate from the render loop and renders draw-call and
 * triangle counts from the renderer. Publishes twice a second; never touches
 * React state.
 */
export function PerfProbe() {
  const frames = useRef(0)
  const last = useRef(0)

  useFrame(({ gl }) => {
    const now = performance.now()
    if (last.current === 0) last.current = now
    frames.current += 1
    const elapsed = now - last.current
    if (elapsed < WINDOW_MS) return
    publishPerf({
      fps: (frames.current * 1000) / elapsed,
      frameMs: elapsed / frames.current,
      drawCalls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
    })
    frames.current = 0
    last.current = now
  })

  return null
}
