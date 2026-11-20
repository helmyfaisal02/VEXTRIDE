import { memo, useEffect } from 'react'
import { CityColliders, CityRoads, DEMO_YARD_ORIGIN } from '../city'
import { EnvColliders, EnvironmentView } from '../environment'
import { useGameStore } from '../state/gameStore'
import { Ground } from './Ground'
import { Lighting } from './Lighting'
import { Props } from './Props'
import { SkyDome } from './SkyDome'
import { StepTestArea } from './StepTestArea'
import { WorldTimeDriver } from './WorldTimeDriver'
import { StreetCoupe } from '../vehicles'

/** Marks the game ready once Rapier's WASM has initialised and the world mounted. */
function ReadySignal() {
  useEffect(() => {
    useGameStore.getState().setPhase('ready')
    return () => useGameStore.getState().setPhase('loading')
  }, [])
  return null
}

/** Everything that lives inside the physics world. */
function WorldImpl() {
  return (
    <>
      <WorldTimeDriver />
      <Lighting />
      <SkyDome />
      <Ground />
      <CityRoads />
      <CityColliders />
      <EnvironmentView />
      <EnvColliders />
      <StreetCoupe />
      {/* Phase 1 demo objects, moved out of the street grid into the demo yard east of the city. */}
      <group position={[DEMO_YARD_ORIGIN.x, 0, DEMO_YARD_ORIGIN.z]}>
        <Props />
      </group>
      <StepTestArea />
      <ReadySignal />
    </>
  )
}

export const World = memo(WorldImpl)
