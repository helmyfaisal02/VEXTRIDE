import type { RapierRigidBody } from '@react-three/rapier'
import type { NPCDefinition,NPCId } from './npcConfig'
/** Only mounted NPCs participate in interactions; no ghost targets after unmount. */
export const npcRegistry=new Map<NPCId,{definition:NPCDefinition;body:RapierRigidBody}>()
