import type { Vector3Tuple } from 'three'

/** World scale: 1 unit = 1 metre. */
export const GRAVITY: Vector3Tuple = [0, -9.81, 0]

export const GROUND_SIZE = 1600
export const GROUND_THICKNESS = 1

/** Direction the sun light travels from (also drives the sky glow). */
export const SUN_POSITION: Vector3Tuple = [60, 55, 35]

export const COLORS = {
  skyTop: '#3f86d6',
  skyMid: '#8ec5f0',
  horizon: '#f7d9b0',
  ground: '#7fa36a',
  gridCell: '#5f8350',
  gridSection: '#476a3c',
  sun: '#fff1cf',
  coral: '#ef6f5e',
  teal: '#2fa6a0',
  cream: '#f2e6cf',
  navy: '#223a63',
  amber: '#f2b84b',
  slate: '#8793a6',
} as const

export const CAMERA = {
  fov: 55,
  /** Larger near plane keeps depth precision high across the city (thin road paint, curbs). */
  near: 0.25,
  far: 1500,
  position: [26, 15, 30] as Vector3Tuple,
  target: [0, 2, 0] as Vector3Tuple,
  minDistance: 6,
  maxDistance: 140,
  /** Stops the camera orbiting below the ground plane. */
  maxPolarAngle: Math.PI / 2 - 0.04,
} as const
