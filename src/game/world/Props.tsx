import { memo } from 'react'
import { ConeCollider, CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier'
import type { Vector3Tuple } from 'three'
import { COLORS } from '../shared/constants'

/* ---------------------------------------------------------------------------
 * Static landmarks: primitive stand-ins that give the camera depth cues and
 * verify fixed colliders. Each sits on y = 0 using its own half-height.
 * ------------------------------------------------------------------------- */

interface Tower {
  position: [number, number]
  size: [number, number, number]
  color: string
}

const TOWERS: readonly Tower[] = [
  { position: [-14, -10], size: [6, 22, 6], color: COLORS.navy },
  { position: [-4, -18], size: [8, 14, 7], color: COLORS.slate },
  { position: [12, -14], size: [5, 30, 5], color: COLORS.teal },
  { position: [24, -4], size: [7, 10, 9], color: COLORS.cream },
  { position: [-26, 6], size: [9, 8, 6], color: COLORS.coral },
]

const Towers = memo(function Towers() {
  return (
    <>
      {TOWERS.map(({ position, size, color }) => (
        <RigidBody
          key={`${position[0]},${position[1]}`}
          type="fixed"
          colliders={false}
          position={[position[0], size[1] / 2, position[1]]}
        >
          <CuboidCollider args={[size[0] / 2, size[1] / 2, size[2] / 2]} />
          <mesh castShadow receiveShadow>
            <boxGeometry args={size} />
            <meshStandardMaterial color={color} roughness={0.8} flatShading />
          </mesh>
        </RigidBody>
      ))}
    </>
  )
})

const Landmarks = memo(function Landmarks() {
  return (
    <>
      {/* Cylinder silo */}
      <RigidBody type="fixed" colliders={false} position={[-18, 4, -26]}>
        <CylinderCollider args={[4, 3]} />
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[3, 3, 8, 24]} />
          <meshStandardMaterial color={COLORS.amber} roughness={0.7} flatShading />
        </mesh>
      </RigidBody>

      {/* Cone beacon */}
      <RigidBody type="fixed" colliders={false} position={[20, 3.5, 14]}>
        <ConeCollider args={[3.5, 3]} />
        <mesh castShadow receiveShadow>
          <coneGeometry args={[3, 7, 5]} />
          <meshStandardMaterial color={COLORS.coral} roughness={0.7} flatShading />
        </mesh>
      </RigidBody>

      {/* Ramp: a rotated slab, good for future vehicle tests */}
      <RigidBody type="fixed" colliders={false} position={[-10, 1.1, 18]} rotation={[0, 0.5, -0.28]}>
        <CuboidCollider args={[6, 0.25, 3]} />
        <mesh castShadow receiveShadow>
          <boxGeometry args={[12, 0.5, 6]} />
          <meshStandardMaterial color={COLORS.slate} roughness={0.9} flatShading />
        </mesh>
      </RigidBody>

      {/* Large sphere */}
      <RigidBody type="fixed" colliders="ball" position={[8, 2.5, 26]}>
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[2.5, 24, 16]} />
          <meshStandardMaterial color={COLORS.teal} roughness={0.5} flatShading />
        </mesh>
      </RigidBody>
    </>
  )
})

/* ---------------------------------------------------------------------------
 * Dynamic bodies: a small crate pyramid and a few balls that drop and settle,
 * proving Rapier ground collision. Layout is deterministic.
 * ------------------------------------------------------------------------- */

const CRATE = 1.2

interface Crate {
  position: Vector3Tuple
  color: string
}

function buildPyramid(): Crate[] {
  const palette = [COLORS.coral, COLORS.amber, COLORS.cream]
  const crates: Crate[] = []
  const rows = 4
  for (let row = 0; row < rows; row++) {
    const count = rows - row
    for (let i = 0; i < count; i++) {
      crates.push({
        position: [
          (i - (count - 1) / 2) * (CRATE + 0.02),
          CRATE / 2 + row * (CRATE + 0.02) + 0.5,
          0,
        ],
        color: palette[(row + i) % palette.length],
      })
    }
  }
  return crates
}

const CRATES = buildPyramid()

const BALLS: ReadonlyArray<{ position: Vector3Tuple; radius: number; color: string }> = [
  { position: [-2.2, 9, 3], radius: 0.7, color: COLORS.navy },
  { position: [0.4, 12, 2.4], radius: 0.9, color: COLORS.teal },
  { position: [2.6, 15, 3.2], radius: 0.6, color: COLORS.coral },
]

const DynamicProps = memo(function DynamicProps() {
  return (
    <group position={[0, 0, 4]}>
      {CRATES.map(({ position, color }) => (
        <RigidBody key={position.join(',')} position={position} colliders="cuboid" friction={0.9}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[CRATE, CRATE, CRATE]} />
            <meshStandardMaterial color={color} roughness={0.75} flatShading />
          </mesh>
        </RigidBody>
      ))}
      {BALLS.map(({ position, radius, color }) => (
        <RigidBody key={position.join(',')} position={position} colliders="ball" restitution={0.45}>
          <mesh castShadow receiveShadow>
            <sphereGeometry args={[radius, 24, 16]} />
            <meshStandardMaterial color={color} roughness={0.4} flatShading />
          </mesh>
        </RigidBody>
      ))}
    </group>
  )
})

function PropsImpl() {
  return (
    <>
      <Towers />
      <Landmarks />
      <DynamicProps />
    </>
  )
}

export const Props = memo(PropsImpl)
