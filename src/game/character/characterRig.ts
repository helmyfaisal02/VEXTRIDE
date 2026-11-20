import { createRef, type RefObject } from 'react'
import type { Group } from 'three'

/** Joint pivots animated procedurally. Each is a `<group>` located at the joint. */
export interface CharacterRig {
  hips: RefObject<Group>
  torso: RefObject<Group>
  head: RefObject<Group>
  armL: RefObject<Group>
  armR: RefObject<Group>
  elbowL: RefObject<Group>
  elbowR: RefObject<Group>
  legL: RefObject<Group>
  legR: RefObject<Group>
  kneeL: RefObject<Group>
  kneeR: RefObject<Group>
}

export function createCharacterRig(): CharacterRig {
  return {
    hips: createRef<Group>(),
    torso: createRef<Group>(),
    head: createRef<Group>(),
    armL: createRef<Group>(),
    armR: createRef<Group>(),
    elbowL: createRef<Group>(),
    elbowR: createRef<Group>(),
    legL: createRef<Group>(),
    legR: createRef<Group>(),
    kneeL: createRef<Group>(),
    kneeR: createRef<Group>(),
  }
}
