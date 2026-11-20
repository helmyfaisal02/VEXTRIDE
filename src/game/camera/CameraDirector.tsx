import { memo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type { PerspectiveCamera } from 'three'
import { useCharacterStore } from '../state/characterStore'
import { useGameStore, type CameraMode } from '../state/gameStore'
import { CharacterPreviewCamera } from './CharacterPreviewCamera'
import { OrbitRig } from './OrbitRig'
import { ThirdPersonCamera } from './ThirdPersonCamera'
import { VehicleCamera } from './VehicleCamera'
import { useVehicleStore } from '../vehicles/vehicleState'
import {
  applyViewOffset,
  beginCameraTransition,
  computeViewOffsetTarget,
  MAX_FRAME_DT,
  stepViewOffset,
  type ViewOffset,
} from './cameraTransition'

export type ActiveCamera = 'preview' | 'follow' | 'orbit' | 'vehicle'

/** The one camera system allowed to run: the creator's preview always wins over gameplay cameras. */
export function selectActiveCamera(creatorOpen: boolean, mode: CameraMode, driving = false): ActiveCamera {
  return creatorOpen ? 'preview' : mode === 'orbit' ? 'orbit' : driving ? 'vehicle' : 'follow'
}

const current: ViewOffset = { x: 0, y: 0 }
const target: ViewOffset = { x: 0, y: 0 }

/**
 * Owns the camera. Mounts exactly one camera system at a time (the creator's
 * preview camera wins over gameplay, and C switches follow/orbit), so two
 * systems can never write the camera in the same frame. On every change it
 * records the outgoing pose so the new system blends in instead of snapping,
 * and it eases the creator's screen-space offset in and out.
 */
function CameraDirectorImpl() {
  const creatorOpen = useCharacterStore((s) => s.menuOpen)
  const cameraMode = useGameStore((s) => s.cameraMode)
  const driving = useVehicleStore((s) => s.driving)
  const active = selectActiveCamera(creatorOpen, cameraMode, driving)
  const camera = useThree((s) => s.camera)

  useEffect(() => {
    beginCameraTransition(camera)
  }, [active, camera])

  useFrame(({ camera: cam, size }, delta) => {
    computeViewOffsetTarget(size.width, size.height, creatorOpen, target)
    stepViewOffset(current, target, Math.min(delta, MAX_FRAME_DT))
    applyViewOffset(cam as PerspectiveCamera, size.width, size.height, current)
  })

  return (
    <>
      {active === 'follow' && <ThirdPersonCamera />}
      {active === 'vehicle' && <VehicleCamera />}
      {active === 'preview' && <CharacterPreviewCamera />}
      {active === 'orbit' && <OrbitRig />}
    </>
  )
}

export const CameraDirector = memo(CameraDirectorImpl)
