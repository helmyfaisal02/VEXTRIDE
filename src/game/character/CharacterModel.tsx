import { memo, useEffect, useState } from 'react'
import {
  applyCharacterColors,
  createCharacterMaterials,
  disposeCharacterMaterials,
  type CharacterMaterials,
} from './characterMaterials'
import type { CharacterRig } from './characterRig'
import { Box, Forearm, Head, Shin, Sneaker, Thigh, TorsoOutfit, UpperArm } from './outfitParts'
import type { Appearance } from './presets'

/**
 * Procedural stylized urban humanoid, about 1.8 m tall with its feet at y = 0
 * and facing +Z. Primitives only: no assets, no network.
 *
 * The joint pivots (hips, waist, shoulders, elbows, knees, head) are fixed and
 * identical for every preset, which is what keeps one animation system working
 * for all of them. A preset only changes the geometry hung below each pivot
 * and the material colours, so switching presets or colours never touches the
 * physics body.
 */

type Side = 1 | -1

interface ModelProps {
  rig: CharacterRig
  appearance: Appearance
}

interface LimbProps {
  side: Side
  rig: CharacterRig
  appearance: Appearance
  m: CharacterMaterials
}

/** One material set for the model's lifetime; recoloured in place when colours change. */
function useCharacterMaterials(appearance: Appearance): CharacterMaterials {
  const [materials] = useState(() => createCharacterMaterials(appearance.colors))
  const colors = appearance.colors
  useEffect(() => {
    applyCharacterColors(materials, colors)
  }, [materials, colors])
  useEffect(() => () => disposeCharacterMaterials(materials), [materials])
  return materials
}

function Arm({ side, rig, appearance, m }: LimbProps) {
  return (
    <group ref={side === 1 ? rig.armL : rig.armR} position={[side * 0.285, 0.43, 0]}>
      <UpperArm top={appearance.top} m={m} />
      <group ref={side === 1 ? rig.elbowL : rig.elbowR} position={[0, -0.29, 0]}>
        <Forearm top={appearance.top} m={m} />
      </group>
    </group>
  )
}

function Leg({ side, rig, appearance, m }: LimbProps) {
  return (
    <group ref={side === 1 ? rig.legL : rig.legR} position={[side * 0.1, 0, 0]}>
      <Thigh bottom={appearance.bottom} side={side} m={m} />
      <group ref={side === 1 ? rig.kneeL : rig.kneeR} position={[0, -0.45, 0]}>
        <Shin bottom={appearance.bottom} m={m} />
        <Sneaker m={m} />
      </group>
    </group>
  )
}

function CharacterModelImpl({ rig, appearance }: ModelProps) {
  const m = useCharacterMaterials(appearance)
  const { hips, torso, head } = rig

  return (
    // Hips pivot sits at the top of the legs (0.95 m above the feet).
    <group ref={hips} position={[0, 0.95, 0]}>
      <Box size={[0.36, 0.18, 0.21]} position={[0, 0.04, 0]} material={m.pants} />

      <Leg side={1} rig={rig} appearance={appearance} m={m} />
      <Leg side={-1} rig={rig} appearance={appearance} m={m} />

      {/* Torso pivot at the waist; shoulders and head hang above it. */}
      <group ref={torso} position={[0, 0.1, 0]}>
        <TorsoOutfit top={appearance.top} m={m} />

        <Arm side={1} rig={rig} appearance={appearance} m={m} />
        <Arm side={-1} rig={rig} appearance={appearance} m={m} />

        <mesh castShadow position={[0, 0.55, 0]} material={m.skin}>
          <cylinderGeometry args={[0.05, 0.055, 0.07, 8]} />
        </mesh>

        <group ref={head} position={[0, 0.64, 0]}>
          <Head headwear={appearance.headwear} m={m} />
        </group>
      </group>
    </group>
  )
}

export const CharacterModel = memo(CharacterModelImpl)
