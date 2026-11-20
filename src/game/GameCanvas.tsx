import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { CameraDirector } from './camera/CameraDirector'
import { FIXED_DT, Player } from './character'
import { CAMERA, GRAVITY } from './shared/constants'
import { PerfProbe } from './shared/PerfProbe'
import { useGameStore } from './state/gameStore'
import { World } from './world/World'

/**
 * Full-viewport R3F canvas. The canvas sizes itself to its parent and tracks
 * resizes, and dpr is capped to bound fill-rate cost on high-density screens.
 * Only `physicsDebug` is subscribed here; the camera director and everything
 * else below it is memoised and subscribes to its own state.
 */
export function GameCanvas() {
  const physicsDebug = useGameStore((s) => s.physicsDebug)

  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ fov: CAMERA.fov, near: CAMERA.near, far: CAMERA.far, position: CAMERA.position }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        // Keep the context restorable instead of letting the browser discard it.
        gl.domElement.addEventListener('webglcontextlost', (e) => e.preventDefault())
      }}
    >
      <Suspense fallback={null}>
        {/*
          Fixed 60 Hz step so character speed and jump height do not depend on
          display frame rate. The negative priority makes physics run before
          every other per-frame system (character sync, camera, animation).
        */}
        <Physics gravity={GRAVITY} timeStep={FIXED_DT} updatePriority={-50} debug={physicsDebug}>
          <World />
          <Player />
          <CameraDirector />
        </Physics>
      </Suspense>
      <PerfProbe />
    </Canvas>
  )
}
