import { create } from 'zustand'
import { Vector3 } from 'three'
import type { RapierRigidBody } from '@react-three/rapier'
import { resetInput } from '../input/inputState'
import { COUPE } from './vehicleConfig'

/** Only discrete mode/hint changes notify React. Simulation data stays mutable. */
export const useVehicleStore = create<{
  driving: boolean; hint: string
  setDriving: (driving: boolean) => void; setHint: (hint: string) => void
}>((set) => ({
  driving: false, hint: '',
  setDriving: (driving) => { resetInput(); set({ driving, hint: '' }) },
  setHint: (hint) => set((s) => s.hint === hint ? s : { hint }),
}))

export const vehicleState = {
  position: new Vector3(COUPE.spawn.x, COUPE.spawn.y, COUPE.spawn.z),
  yaw: COUPE.spawnYaw, speed: 0, steering: 0, wheelRoll: 0, grounded: false,
}

/** Runtime references only; never persisted or placed in a URL/store. */
export const vehicleRuntime: { body: RapierRigidBody | null; pedestrian: RapierRigidBody | null } = { body: null, pedestrian: null }
