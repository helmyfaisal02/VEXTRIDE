import { useEffect, useRef } from 'react'
import { subscribePerf } from '../shared/perfStats'
import { useVehicleStore, vehicleState } from '../vehicles/vehicleState'
import { useCharacterStore } from '../state/characterStore'
import { getVehicleDefinition } from '../vehicles/vehicleConfig'
import { inputState } from '../input/inputState'

export function VehicleHud() {
  const driving = useVehicleStore((s) => s.driving), hint = useVehicleStore((s) => s.hint)
  const recoveryHint=useVehicleStore(s=>s.recoveryHint)
  const activeId=useVehicleStore(s=>s.activeVehicleId)
  const creator = useCharacterStore((s) => s.menuOpen)
  const readout = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!driving) return
    return subscribePerf(() => {
      if (readout.current) readout.current.textContent = `${Math.round(Math.abs(vehicleState.speed) * 3.6)} km/h · ${inputState.jumpHeld ? 'Handbrake' : Math.abs(vehicleState.speed) < .15 ? 'N · Stopped' : vehicleState.speed < 0 ? 'R · Reverse' : 'D · Driving'}`
    })
  }, [driving])
  if (creator || (!driving && !hint)) return null
  return (
    <div className="space-y-2 text-center text-white" data-testid="vehicle-hud">
      {driving && <div className="rounded-2xl bg-[#142440]/90 px-5 py-3 shadow-lg">
        <p className="text-xs font-semibold">{activeId ? getVehicleDefinition(activeId).name : ''}</p>
        <div ref={readout} className="mt-1 text-xl font-bold tabular-nums">0 km/h · N · Stopped</div>
        <p className="mt-1 text-xs text-white/85">W Accelerate · S Brake / Reverse · A/D Steer</p>
        <p className="text-xs text-white/85">Space Handbrake · E Exit when stopped</p>
      </div>}
      {driving && recoveryHint && <p className="rounded-xl bg-[#142440]/90 px-4 py-2 text-xs" data-testid="recovery-hint">{recoveryHint}</p>}
      {hint && <p className="rounded-xl bg-[#142440]/90 px-4 py-2 text-xs" data-testid="vehicle-hint">{hint}</p>}
    </div>
  )
}
