import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { PointLight, Vector3 } from 'three'
import { playerState } from '../character'
import { surfaceHeightAt } from '../city/citySurface'
import { ROAD_TOP } from '../city/cityConfig'
import { worldLighting } from '../world/dayNight'
import { ENVIRONMENT } from './envLayout'
import { Frame } from './localFrame'

export const STREET_LIGHT_POOL_SIZE = 4
export const STREET_LIGHT_RANGE = 28

// Same local frame/arm offset as propModels.streetlight. No new geometry or placements.
const lamps = ENVIRONMENT.props.filter((p) => p.kind === 'streetlight').map((p) => {
  const f = new Frame(p.x, p.z, p.facing)
  return new Vector3(...f.pt(0, (surfaceHeightAt(p.x, p.z) || ROAD_TOP) + 5.9, 1.45))
})

/** Only this small pool contributes real light. All city lamps use merged emissive surfaces. */
export function StreetLights({ poolSize = STREET_LIGHT_POOL_SIZE }: { poolSize?: number }) {
  const [slots] = useState(() => Array.from({ length: Math.max(0, Math.min(8, Math.floor(poolSize))) }, () => ({ light: new PointLight('#ffe3a3', 0, 23, 2), current: -1, desired: -1 })))
  const mutableSlots = useRef(slots)
  const elapsed = useRef(1)
  useFrame((_, delta) => {
    const slots = mutableSlots.current
    elapsed.current += delta
    if (elapsed.current >= 0.5) {
      elapsed.current = 0
      const nearby = lamps.map((position, index) => ({ index, distance: Math.hypot(position.x - playerState.position.x, position.z - playerState.position.z) }))
        .filter((lamp) => lamp.distance < STREET_LIGHT_RANGE).sort((a, b) => a.distance - b.distance).slice(0, slots.length)
      const wanted = new Set(nearby.map((lamp) => lamp.index))
      // Retain occupied slots to avoid light hopping when nearest order changes.
      for (const slot of slots) {
        slot.desired = wanted.has(slot.current) ? slot.current : -1
        wanted.delete(slot.desired)
      }
      for (const slot of slots) if (slot.desired < 0) {
        slot.desired = wanted.values().next().value ?? -1
        wanted.delete(slot.desired)
      }
    }
    const blend = 1 - Math.exp(-Math.min(delta, 0.1) * 8)
    for (const slot of slots) {
      const relocating = slot.current !== slot.desired
      const target = relocating || slot.current < 0 ? 0 : 85 * worldLighting.night
      slot.light.intensity += (target - slot.light.intensity) * blend
      if (relocating && slot.light.intensity < 0.05) {
        slot.current = slot.desired
        slot.light.intensity = 0
        if (slot.current >= 0) slot.light.position.copy(lamps[slot.current])
      }
      slot.light.visible = slot.current >= 0 && slot.light.intensity > 0.01
    }
  })
  return <>{slots.map((slot, index) => <primitive key={index} object={slot.light} />)}</>
}
