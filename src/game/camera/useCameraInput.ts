import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { cameraRig, FOLLOW, type CameraRig } from './cameraRig'

export interface OrbitLimits {
  minPitch: number
  maxPitch: number
  minDistance: number
  maxDistance: number
  rotateSensitivity: number
  zoomSensitivity: number
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

function applyDrag(rig: CameraRig, dx: number, dy: number, l: OrbitLimits): void {
  rig.yaw -= dx * l.rotateSensitivity
  rig.pitch = clamp(rig.pitch + dy * l.rotateSensitivity, l.minPitch, l.maxPitch)
}

function applyZoom(rig: CameraRig, deltaY: number, l: OrbitLimits): void {
  rig.distance = clamp(rig.distance * Math.exp(deltaY * l.zoomSensitivity), l.minDistance, l.maxDistance)
}

/**
 * Pointer drag rotates `rig` around its target and the wheel zooms it.
 * Listeners sit on the canvas only and are removed on unmount. `onInteract`
 * fires on any drag or zoom (for example to pause an auto-rotation).
 */
export function usePointerOrbit(rig: CameraRig, limits: OrbitLimits, onInteract?: () => void): void {
  const dom = useThree((s) => s.gl.domElement)

  useEffect(() => {
    let activePointer: number | null = null

    const onPointerDown = (e: PointerEvent) => {
      if (activePointer !== null) return
      activePointer = e.pointerId
      dom.setPointerCapture(e.pointerId)
      dom.style.cursor = 'grabbing'
      onInteract?.()
    }
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerId !== activePointer) return
      applyDrag(rig, e.movementX, e.movementY, limits)
      onInteract?.()
    }
    const release = (e: PointerEvent) => {
      if (e.pointerId !== activePointer) return
      activePointer = null
      dom.style.cursor = ''
      if (dom.hasPointerCapture(e.pointerId)) dom.releasePointerCapture(e.pointerId)
      onInteract?.()
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      // deltaMode 1 is lines; normalise to roughly pixel scale.
      applyZoom(rig, e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY, limits)
      onInteract?.()
    }
    const onContextMenu = (e: Event) => e.preventDefault()
    // A drag must never stay "held" if the browser takes the pointer away.
    const onBlur = () => {
      activePointer = null
      dom.style.cursor = ''
    }

    dom.addEventListener('pointerdown', onPointerDown)
    dom.addEventListener('pointermove', onPointerMove)
    dom.addEventListener('pointerup', release)
    dom.addEventListener('pointercancel', release)
    dom.addEventListener('lostpointercapture', release)
    window.addEventListener('blur', onBlur)
    dom.addEventListener('wheel', onWheel, { passive: false })
    dom.addEventListener('contextmenu', onContextMenu)
    return () => {
      dom.removeEventListener('pointerdown', onPointerDown)
      dom.removeEventListener('pointermove', onPointerMove)
      dom.removeEventListener('pointerup', release)
      dom.removeEventListener('pointercancel', release)
      dom.removeEventListener('lostpointercapture', release)
      window.removeEventListener('blur', onBlur)
      dom.removeEventListener('wheel', onWheel)
      dom.removeEventListener('contextmenu', onContextMenu)
      dom.style.cursor = ''
    }
  }, [dom, rig, limits, onInteract])
}

/** Gameplay camera input: drag to rotate around the player, wheel to zoom. */
export function useCameraInput(): void {
  usePointerOrbit(cameraRig, FOLLOW)
}
