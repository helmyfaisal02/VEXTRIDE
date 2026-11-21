import { memo } from 'react'
import { Grid } from '@react-three/drei'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { COLORS, GROUND_SIZE, GROUND_THICKNESS } from '../shared/constants'

const HALF_EXTENT = GROUND_SIZE / 2

/** Large visual plane plus a fixed Rapier slab whose top face sits at y = 0. */
function GroundImpl() {
  return (
    <>
      <RigidBody type="fixed" colliders={false} friction={1}>
        <CuboidCollider
          args={[HALF_EXTENT, GROUND_THICKNESS / 2, HALF_EXTENT]}
          position={[0, -GROUND_THICKNESS / 2, 0]}
        />
      </RigidBody>

      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
        <meshStandardMaterial color={COLORS.ground} roughness={1} metalness={0} />
      </mesh>

      <Grid
        position={[0, 0.01, 0]}
        args={[GROUND_SIZE, GROUND_SIZE]}
        // Match the terrain footprint. Drei's infinite mode multiplies the
        // vertices by (1 + fadeDistance), which let this grid draw over the city.
        cellSize={2}
        cellThickness={0.6}
        cellColor={COLORS.gridCell}
        sectionSize={10}
        sectionThickness={1.2}
        sectionColor={COLORS.gridSection}
        fadeDistance={160}
        fadeStrength={1.5}
      />
    </>
  )
}

export const Ground = memo(GroundImpl)
