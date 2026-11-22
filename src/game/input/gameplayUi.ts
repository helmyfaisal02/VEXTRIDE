import { useGarageStore } from '../garage/garageState'
import { useDialogueStore } from '../interactions/dialogueState'
import { useCharacterStore } from '../state/characterStore'
import { isWalletPanelOpen } from './inputState'

export function isGameplayModalOpen(): boolean {
  return isWalletPanelOpen() || useCharacterStore.getState().menuOpen ||
    useGarageStore.getState().open || !!useDialogueStore.getState().active
}
