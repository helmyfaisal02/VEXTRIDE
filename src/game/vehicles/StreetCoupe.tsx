import { memo } from 'react'
import { COUPE } from './vehicleConfig'
import { VehicleSystem } from './VehicleSystem'

const COUPE_ONLY=[COUPE]
/** Existing single-coupe embedding API; same shared controller as the full fleet. */
export const StreetCoupe=memo(function StreetCoupe(){return <VehicleSystem definitions={COUPE_ONLY}/>})
