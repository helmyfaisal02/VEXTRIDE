import { create } from 'zustand'

export type GamePhase = 'loading' | 'ready'
export type CameraMode = 'follow' | 'orbit'

interface GameState {
  phase: GamePhase
  /** Draws Rapier collider wireframes. Toggled with the P key. */
  physicsDebug: boolean
  /** Shows the measured performance readout. Toggled with the F key. */
  showPerf: boolean
  /** `follow` is the gameplay camera; `orbit` is the free debug camera (C key). */
  cameraMode: CameraMode
  setPhase: (phase: GamePhase) => void
  togglePhysicsDebug: () => void
  togglePerf: () => void
  toggleCameraMode: () => void
}

/**
 * Global game state. Components must subscribe with narrow selectors, for
 * example `useGameStore((s) => s.phase)`, so unrelated updates never re-render
 * them. Per-frame data (positions, velocities) does not belong here.
 */
export const useGameStore = create<GameState>((set) => ({
  phase: 'loading',
  physicsDebug: false,
  showPerf: false,
  cameraMode: 'follow',
  setPhase: (phase) => set({ phase }),
  toggleCameraMode: () =>
    set((s) => ({ cameraMode: s.cameraMode === 'follow' ? 'orbit' : 'follow' })),
  togglePhysicsDebug: () => set((s) => ({ physicsDebug: !s.physicsDebug })),
  togglePerf: () => set((s) => ({ showPerf: !s.showPerf })),
}))
