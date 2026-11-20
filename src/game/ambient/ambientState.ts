import type { RapierRigidBody } from '@react-three/rapier'
/** Observability only: never registered as player vehicles or interactive NPCs. */
export const ambientBodies=new Map<string,RapierRigidBody>()
export const ambientTraffic=new Map<string,{speed:number;desired:number;blocked:boolean;distance:number;laneId:string;movementId:string|null;roll:number;steer:number}>()
export const ambientWalkers=new Map<string,{speed:number;blocked:boolean;target:number;phase:number;wait:number}>()
