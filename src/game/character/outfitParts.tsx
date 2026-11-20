import type { ReactNode } from 'react'
import type { Vector3Tuple } from 'three'
import type { CharacterMaterials } from './characterMaterials'
import type { BottomStyle, HeadwearStyle, TopStyle } from './presets'

/**
 * Outfit pieces for the procedural humanoid. Each component draws geometry
 * only, in the local space of the joint it is placed under, so swapping an
 * outfit never changes the rig, the proportions or the physics.
 */

type Mat = CharacterMaterials[keyof CharacterMaterials]

interface BoxProps {
  size: Vector3Tuple
  position: Vector3Tuple
  material: Mat
  cast?: boolean
}

export function Box({ size, position, material, cast = true }: BoxProps) {
  return (
    <mesh castShadow={cast} position={position} material={material}>
      <boxGeometry args={size} />
    </mesh>
  )
}

interface PartProps {
  m: CharacterMaterials
}

/* --------------------------------- torso ----------------------------------- */

/** Torso pivot is the waist; pieces extend upward to the shoulders (y up to ~0.52). */
export function TorsoOutfit({ top, m }: PartProps & { top: TopStyle }) {
  switch (top) {
    case 'bomber':
      return (
        <>
          <Box size={[0.46, 0.46, 0.26]} position={[0, 0.28, 0]} material={m.top} />
          {/* Ribbed hem and collar are the bomber's signature. */}
          <Box size={[0.47, 0.07, 0.275]} position={[0, 0.06, 0]} material={m.topTrim} />
          <mesh castShadow position={[0, 0.54, 0]} material={m.topTrim}>
            <cylinderGeometry args={[0.1, 0.12, 0.07, 10]} />
          </mesh>
          <Box size={[0.014, 0.4, 0.006]} position={[0, 0.28, 0.133]} material={m.light} cast={false} />
          {/* Shoulder stripes. */}
          <Box size={[0.1, 0.02, 0.27]} position={[0.2, 0.46, 0]} material={m.light} cast={false} />
          <Box size={[0.1, 0.02, 0.27]} position={[-0.2, 0.46, 0]} material={m.light} cast={false} />
        </>
      )
    case 'hoodie':
      return (
        <>
          <Box size={[0.47, 0.54, 0.28]} position={[0, 0.27, 0]} material={m.top} />
          <Box size={[0.48, 0.06, 0.29]} position={[0, 0.04, 0]} material={m.topTrim} />
          {/* Kangaroo pocket. */}
          <Box size={[0.3, 0.12, 0.03]} position={[0, 0.15, 0.145]} material={m.topTrim} />
          {/* Hood bunched around the neck and down the back. */}
          <mesh castShadow position={[0, 0.55, -0.01]} rotation={[Math.PI / 2, 0, 0]} material={m.topTrim}>
            <torusGeometry args={[0.1, 0.045, 6, 12]} />
          </mesh>
          <Box size={[0.26, 0.2, 0.1]} position={[0, 0.46, -0.16]} material={m.topTrim} />
          {/* Drawstrings. */}
          <Box size={[0.012, 0.1, 0.01]} position={[0.04, 0.44, 0.143]} material={m.light} cast={false} />
          <Box size={[0.012, 0.1, 0.01]} position={[-0.04, 0.44, 0.143]} material={m.light} cast={false} />
        </>
      )
    case 'utility':
      return (
        <>
          <Box size={[0.46, 0.56, 0.27]} position={[0, 0.28, 0]} material={m.top} />
          {/* Belt, chest pockets with flaps, epaulettes and a stand collar. */}
          <Box size={[0.47, 0.045, 0.28]} position={[0, 0.045, 0]} material={m.pantsTrim} />
          <Box size={[0.11, 0.1, 0.03]} position={[0.1, 0.33, 0.145]} material={m.topTrim} />
          <Box size={[0.11, 0.1, 0.03]} position={[-0.1, 0.33, 0.145]} material={m.topTrim} />
          <Box size={[0.12, 0.03, 0.036]} position={[0.1, 0.385, 0.146]} material={m.top} />
          <Box size={[0.12, 0.03, 0.036]} position={[-0.1, 0.385, 0.146]} material={m.top} />
          <Box size={[0.1, 0.025, 0.14]} position={[0.17, 0.57, 0]} material={m.topTrim} />
          <Box size={[0.1, 0.025, 0.14]} position={[-0.17, 0.57, 0]} material={m.topTrim} />
          <Box size={[0.22, 0.06, 0.17]} position={[0, 0.58, 0]} material={m.topTrim} />
          <Box size={[0.014, 0.44, 0.006]} position={[0, 0.3, 0.138]} material={m.light} cast={false} />
        </>
      )
  }
}

/* ---------------------------------- arms ----------------------------------- */

/** Sleeve silhouette: [upper width, forearm width] per top style. */
const SLEEVE: Record<TopStyle, readonly [number, number]> = {
  bomber: [0.125, 0.115],
  hoodie: [0.12, 0.11],
  utility: [0.115, 0.105],
}

/** Upper arm (under the shoulder pivot) and its details. */
export function UpperArm({ top, m }: PartProps & { top: TopStyle }) {
  const w = SLEEVE[top][0]
  return <Box size={[w, 0.3, w + 0.01]} position={[0, -0.14, 0]} material={m.top} />
}

/** Forearm (under the elbow pivot): sleeve, cuff and hand. */
export function Forearm({ top, m }: PartProps & { top: TopStyle }) {
  const w = SLEEVE[top][1]
  return (
    <>
      <Box size={[w, 0.25, w + 0.01]} position={[0, -0.12, 0]} material={m.top} />
      <Box size={[w + 0.012, 0.05, w + 0.022]} position={[0, -0.235, 0]} material={m.topTrim} />
      <mesh castShadow position={[0, -0.31, 0]} material={m.skin}>
        <sphereGeometry args={[0.055, 10, 8]} />
      </mesh>
    </>
  )
}

/* ---------------------------------- legs ----------------------------------- */

/** Thigh (under the hip pivot). `side` is +1 for the left leg, whose outer face is +x. */
export function Thigh({ bottom, side, m }: PartProps & { bottom: BottomStyle; side: 1 | -1 }) {
  if (bottom === 'cargo') {
    return (
      <>
        <Box size={[0.185, 0.45, 0.195]} position={[0, -0.22, 0]} material={m.pants} />
        {/* Cargo pocket with a flap on the outer thigh. */}
        <Box size={[0.05, 0.15, 0.13]} position={[side * 0.1, -0.2, 0]} material={m.pantsTrim} />
        <Box size={[0.054, 0.03, 0.134]} position={[side * 0.1, -0.12, 0]} material={m.pants} />
      </>
    )
  }
  const w = bottom === 'jeans' ? 0.165 : 0.15
  return <Box size={[w, 0.45, w + 0.01]} position={[0, -0.22, 0]} material={m.pants} />
}

/** Shin (under the knee pivot): trouser leg and hem. */
export function Shin({ bottom, m }: PartProps & { bottom: BottomStyle }) {
  const w = bottom === 'cargo' ? 0.165 : bottom === 'jeans' ? 0.145 : 0.135
  return (
    <>
      <Box size={[w, 0.37, w + 0.01]} position={[0, -0.18, 0]} material={m.pants} />
      {/* Hem: rolled cuff on chinos, tight band on cargos, plain on jeans. */}
      {bottom !== 'jeans' && (
        <Box size={[w + 0.014, 0.045, w + 0.024]} position={[0, -0.355, 0]} material={m.pantsTrim} />
      )}
    </>
  )
}

/** Sneaker (under the knee pivot, ankle at y = -0.4, sole at y = -0.5). */
export function Sneaker({ m }: PartProps) {
  return (
    <>
      <Box size={[0.15, 0.075, 0.29]} position={[0, -0.455, 0.05]} material={m.shoe} />
      {/* Ankle collar and tongue. */}
      <Box size={[0.13, 0.06, 0.15]} position={[0, -0.405, -0.01]} material={m.shoe} />
      <Box size={[0.07, 0.04, 0.05]} position={[0, -0.41, 0.09]} material={m.light} cast={false} />
      {/* Rubber toe cap and sole. */}
      <Box size={[0.152, 0.05, 0.07]} position={[0, -0.465, 0.175]} material={m.sole} />
      <Box size={[0.16, 0.03, 0.305]} position={[0, -0.485, 0.05]} material={m.sole} />
    </>
  )
}

/* ---------------------------------- head ----------------------------------- */

/** Head (pivot at the centre of the skull, radius ~0.115): face plus headwear. */
export function Head({ headwear, m }: PartProps & { headwear: HeadwearStyle }) {
  return (
    <>
      <mesh castShadow material={m.skin}>
        <sphereGeometry args={[0.115, 14, 12]} />
      </mesh>
      {/* Ears and nose give the head a readable profile. */}
      <mesh position={[0.113, 0, 0]} material={m.skin}>
        <sphereGeometry args={[0.025, 8, 6]} />
      </mesh>
      <mesh position={[-0.113, 0, 0]} material={m.skin}>
        <sphereGeometry args={[0.025, 8, 6]} />
      </mesh>
      <Box size={[0.025, 0.035, 0.03]} position={[0, -0.01, 0.115]} material={m.skin} cast={false} />
      <Box size={[0.026, 0.03, 0.02]} position={[0.045, 0.015, 0.104]} material={m.eye} cast={false} />
      <Box size={[0.026, 0.03, 0.02]} position={[-0.045, 0.015, 0.104]} material={m.eye} cast={false} />
      <Hair headwear={headwear} m={m} />
    </>
  )
}

function Hair({ headwear, m }: PartProps & { headwear: HeadwearStyle }): ReactNode {
  switch (headwear) {
    case 'short-hair':
      return (
        <>
          <mesh castShadow position={[0, 0.02, -0.008]} material={m.hair}>
            <sphereGeometry args={[0.122, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.46]} />
          </mesh>
          {/* Swept fringe. */}
          <Box size={[0.2, 0.04, 0.05]} position={[0.01, 0.085, 0.085]} material={m.hair} />
          <Box size={[0.2, 0.09, 0.05]} position={[0, -0.01, -0.105]} material={m.hair} />
        </>
      )
    case 'beanie':
      return (
        <>
          <mesh castShadow position={[0, 0.03, -0.005]} material={m.headwear}>
            <sphereGeometry args={[0.125, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
          </mesh>
          {/* Folded brim. */}
          <mesh castShadow position={[0, 0.045, -0.005]} material={m.top}>
            <cylinderGeometry args={[0.127, 0.127, 0.045, 14]} />
          </mesh>
          <Box size={[0.2, 0.06, 0.04]} position={[0, -0.03, -0.11]} material={m.hair} />
        </>
      )
    case 'cap':
      return (
        <>
          <mesh castShadow position={[0, 0.025, -0.005]} material={m.headwear}>
            <sphereGeometry args={[0.123, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
          </mesh>
          {/* Visor. */}
          <Box size={[0.2, 0.018, 0.1]} position={[0, 0.035, 0.125]} material={m.headwear} />
          <Box size={[0.2, 0.07, 0.04]} position={[0, -0.02, -0.108]} material={m.hair} />
        </>
      )
  }
}
