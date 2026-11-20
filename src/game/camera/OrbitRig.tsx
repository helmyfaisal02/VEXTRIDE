import { memo, useState } from 'react'
import { useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { Vector3Tuple } from 'three'
import { Vector3 } from 'three'
import { playerState } from '../character'
import { CAMERA } from '../shared/constants'
import { orbitTargetFromView } from './cameraTransition'

/**
 * Damped debug orbit camera: drag to orbit, wheel to zoom, right-drag to pan.
 * It starts looking exactly where the previous camera was looking, so
 * switching to it never turns the view.
 */
function OrbitRigImpl() {
  const camera = useThree((s) => s.camera)
  const [target] = useState<Vector3Tuple>(() => {
    const direction = camera.getWorldDirection(new Vector3())
    const t = orbitTargetFromView(camera.position, direction, playerState.position, new Vector3())
    return [t.x, t.y, t.z]
  })

  return (
    <OrbitControls
      makeDefault
      target={target}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.7}
      zoomSpeed={0.8}
      panSpeed={0.8}
      minDistance={CAMERA.minDistance}
      maxDistance={CAMERA.maxDistance}
      maxPolarAngle={CAMERA.maxPolarAngle}
    />
  )
}

export const OrbitRig = memo(OrbitRigImpl)
