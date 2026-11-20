import { memo, useMemo, useRef } from 'react'
import {
  CapsuleCollider,
  CoefficientCombineRule,
  RigidBody,
  type RapierRigidBody,
} from '@react-three/rapier'
import type { Group } from 'three'
import { useKeyboardInput } from '../input'
import { useCharacterStore } from '../state/characterStore'
import { CharacterModel } from './CharacterModel'
import { createCharacterRig, type CharacterRig } from './characterRig'
import {
  CAPSULE_HALF_SEGMENT,
  CAPSULE_RADIUS,
  FEET_OFFSET,
  GRAVITY_SCALE,
  SPAWN_POSITION,
} from './config'
import { resolveAppearance } from './presets'
import { useCharacterAnimation } from './useCharacterAnimation'
import { useCharacterController } from './useCharacterController'

/**
 * The visible model. It alone subscribes to the character settings, so changing
 * preset or colours re-renders only the model's meshes: the physics body, its
 * position and the controller are never touched. While the creator is open it
 * shows the draft, so every choice previews live on the real player.
 */
const PlayerModel = memo(function PlayerModel({ rig }: { rig: CharacterRig }) {
  const preset = useCharacterStore((s) => (s.menuOpen ? s.draft : s.settings).preset)
  const topColor = useCharacterStore((s) => (s.menuOpen ? s.draft : s.settings).topColor)
  // The name never changes the model, so it is deliberately not a dependency.
  const appearance = useMemo(() => resolveAppearance({ name: '', preset, topColor }), [preset, topColor])
  return <CharacterModel rig={rig} appearance={appearance} />
})

/**
 * The player: an upright, rotation-locked dynamic capsule steered by the character controller,
 * with a procedural humanoid parented to it. The body is never rotated; only
 * the visual yaw group turns to face the direction of travel.
 */
function PlayerImpl() {
  const bodyRef = useRef<RapierRigidBody>(null)
  const visualRef = useRef<Group>(null)
  const yawRef = useRef<Group>(null)
  const rig = useMemo(() => createCharacterRig(), [])

  useKeyboardInput()
  useCharacterController(bodyRef, visualRef, yawRef)
  useCharacterAnimation(rig)

  return (
    <RigidBody
      ref={bodyRef}
      type="dynamic"
      colliders={false}
      position={SPAWN_POSITION}
      lockRotations
      canSleep={false}
      ccd
      gravityScale={GRAVITY_SCALE}
      linearDamping={0}
    >
      <CapsuleCollider
        args={[CAPSULE_HALF_SEGMENT, CAPSULE_RADIUS]}
        friction={0}
        restitution={0}
        frictionCombineRule={CoefficientCombineRule.Min}
        restitutionCombineRule={CoefficientCombineRule.Min}
      />
      <group ref={visualRef}>
        <group ref={yawRef} rotation-y={Math.PI}>
          <group position-y={-FEET_OFFSET}>
            <PlayerModel rig={rig} />
          </group>
        </group>
      </group>
    </RigidBody>
  )
}

export const Player = memo(PlayerImpl)
