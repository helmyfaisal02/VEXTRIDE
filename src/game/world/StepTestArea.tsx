import { memo } from 'react'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { STEP } from '../character/config'
import { DEMO_YARD_ORIGIN } from '../city/cityConfig'
import { COLORS } from '../shared/constants'

/**
 * Small, out-of-the-way test area for the character's step-up: blocks of
 * rising height, plus a short staircase. Green blocks are within the step
 * limit (`STEP.maxHeight`) and should be climbed; coral ones are taller and
 * should block. Lives in the demo yard east of the city. Real geometry with fixed physics colliders; the stand-in for
 * future curbs and sidewalks.
 */
export const STEP_TEST_ORIGIN_X = DEMO_YARD_ORIGIN.x - 45
export const STEP_TEST_ORIGIN_Z = -60
const ORIGIN_X = STEP_TEST_ORIGIN_X
const ORIGIN_Z = STEP_TEST_ORIGIN_Z
const BLOCK_HEIGHTS = [0.1, 0.15, 0.2, 0.25, 0.35, 1] as const
const BLOCK_SPACING = 5
const BLOCK_SIZE = [3, 6] as const

/** Each block's centre x, its height, and whether it is within the step limit. */
export const STEP_TEST_LANES = BLOCK_HEIGHTS.map((height, i) => ({
  x: ORIGIN_X + i * BLOCK_SPACING,
  height,
  climbable: height <= STEP.maxHeight,
}))
/** z of the blocks' near face (the side to approach from, walking toward -z). */
export const STEP_TEST_FRONT_Z = ORIGIN_Z + BLOCK_SIZE[1] / 2

const STAIR_X = ORIGIN_X + BLOCK_HEIGHTS.length * BLOCK_SPACING + 2
const STAIR_RISE = 0.15
const STAIR_TREAD = 0.8
const STAIR_COUNT = 4

function Block({
  position,
  size,
  color,
}: {
  position: [number, number, number]
  size: [number, number, number]
  color: string
}) {
  return (
    <RigidBody type="fixed" colliders={false} position={position}>
      <CuboidCollider args={[size[0] / 2, size[1] / 2, size[2] / 2]} />
      <mesh castShadow receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial color={color} roughness={0.85} flatShading />
      </mesh>
    </RigidBody>
  )
}

function StepTestAreaImpl() {
  return (
    <group>
      {BLOCK_HEIGHTS.map((h, i) => (
        <Block
          key={h}
          position={[ORIGIN_X + i * BLOCK_SPACING, h / 2, ORIGIN_Z]}
          size={[BLOCK_SIZE[0], h, BLOCK_SIZE[1]]}
          color={h <= STEP.maxHeight ? COLORS.teal : COLORS.coral}
        />
      ))}
      {Array.from({ length: STAIR_COUNT }, (_, i) => {
        const height = STAIR_RISE * (i + 1)
        return (
          <Block
            key={i}
            position={[STAIR_X, height / 2, ORIGIN_Z + 3 - STAIR_TREAD * (i + 0.5)]}
            size={[BLOCK_SIZE[0], height, STAIR_TREAD]}
            color={COLORS.cream}
          />
        )
      })}
    </group>
  )
}

export const StepTestArea = memo(StepTestAreaImpl)
