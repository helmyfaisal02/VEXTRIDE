import { useEffect, useRef, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useBeforePhysicsStep, useRapier, type RapierRigidBody } from '@react-three/rapier'
import { Vector3, type Group } from 'three'
import { useDialogueStore } from '../interactions/dialogueState'
import { inputState } from '../input'
import { dampAngle } from '../shared/math'
import { createStepProbeResult, probeGround, type CharacterProbe } from './characterProbes'
import { createCharacterSim, stepCharacter, type CharacterSim } from './characterSim'
import { playerState } from './playerState'
import { useVehicleStore, vehicleRuntime, vehicleState } from '../vehicles/vehicleState'

const TURN_RATE = 14
const camDir = new Vector3()

/**
 * Character controller for a dynamic, rotation-locked Rapier capsule.
 *
 * - Simulation runs inside the physics fixed step (`FIXED_DT`), so speed, gravity
 *   and jump height are identical at any display frame rate.
 * - Only the body's velocity is set; Rapier's contact solver resolves collisions,
 *   so the capsule is never moved through colliders by hand.
 * - Ground contact comes from short downward ray casts (see `probeGround`).
 * - A per-frame `useFrame` only syncs the interpolated visual position into
 *   `playerState` and smooths the facing direction.
 */
export function useCharacterController(
  bodyRef: RefObject<RapierRigidBody>,
  visualRef: RefObject<Group>,
  yawRef: RefObject<Group>,
): void {
  const { world, rapier } = useRapier()
  const getState = useThree((s) => s.get)
  const sim = useRef<CharacterSim>(createCharacterSim())
  const wasDriving = useRef(false)
  const wasTalking = useRef(false)
  useEffect(() => () => { vehicleRuntime.pedestrian = null }, [])
  const probe = useRef<CharacterProbe | null>(null)
  probe.current ??= {
    world,
    ray: new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 }),
    // Level geometry only: crates and other dynamic bodies never count as ledges or ceilings.
    staticFlags: rapier.QueryFilterFlags.EXCLUDE_DYNAMIC | rapier.QueryFilterFlags.EXCLUDE_SENSORS,
    step: createStepProbeResult(),
  }

  useBeforePhysicsStep(() => {
    const body = bodyRef.current
    const characterProbe = probe.current
    if (!body || !characterProbe) return
    vehicleRuntime.pedestrian = body
    const driving = useVehicleStore.getState().driving
    if (driving) {
      wasDriving.current = true
      playerState.speed = 0
      playerState.animState = 'idle'
      playerState.grounded = true
      return
    }
    if (wasDriving.current) { sim.current = createCharacterSim(); wasDriving.current = false }

    if(useDialogueStore.getState().active){
      wasTalking.current=true
      const velocity=body.linvel()
      body.setLinvel({x:0,y:velocity.y,z:0},true)
      playerState.speed=0;playerState.animState='idle'
      return
    }
    if(wasTalking.current){sim.current=createCharacterSim();wasTalking.current=false}

    // Camera-relative basis on the ground plane.
    getState().camera.getWorldDirection(camDir)
    const groundGap = probeGround(characterProbe, body)
    stepCharacter(sim.current, inputState, camDir.x, camDir.z, body, groundGap, characterProbe)
  })

  // Runs after the physics step (which uses a lower priority number), so the
  // body's object has already been interpolated for this frame.
  useFrame((_, delta) => {
    const visual = visualRef.current
    if (useVehicleStore.getState().driving) playerState.position.copy(vehicleState.position)
    else if (visual) visual.getWorldPosition(playerState.position)

    const yaw = yawRef.current
    if (yaw && playerState.speed > 0.3) {
      const target = Math.atan2(playerState.heading.x, playerState.heading.z)
      yaw.rotation.y = dampAngle(yaw.rotation.y, target, TURN_RATE, Math.min(delta, 0.1))
    }
    if (yaw) playerState.facingYaw = yaw.rotation.y
  }, -10)
}
