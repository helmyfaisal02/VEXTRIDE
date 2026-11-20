import type { Camera, Vector3 } from 'three'
import type { useRapier } from '@react-three/rapier'
import { cameraClearance } from './cameraCollision'

/** A handoff may move the rendered pose through a wall after the desired pose was checked.
 * Re-aim only when collision relocates it; ordinary handoff/orbit orientation is preserved.
 */
export function constrainVehicleCamera(physics:Pick<ReturnType<typeof useRapier>,'world'|'rapier'>,camera:Camera,focus:Vector3,probe:InstanceType<ReturnType<typeof useRapier>['rapier']['Ball']>,direction:Vector3):boolean {
  direction.copy(camera.position).sub(focus)
  const length=direction.length()
  if(length<1e-6)return false
  direction.divideScalar(length)
  const safe=cameraClearance(physics,focus,direction,length,probe)
  if(safe>=length)return false
  camera.position.copy(focus).addScaledVector(direction,safe)
  camera.lookAt(focus)
  return true
}
