import { create } from 'zustand'
import {
  isValidName,
  loadCharacter,
  sanitizeName,
  saveCharacter,
  type SaveStatus,
} from '../character/persistence'
import {
  getPreset,
  TOP_COLOR_COUNT,
  type CharacterSettings,
  type PresetId,
} from '../character/presets'

interface CharacterStore {
  /** Committed character: what is saved and what plays. */
  settings: CharacterSettings
  /** Work in progress while the creator is open; previewed live on the player model. */
  draft: CharacterSettings
  menuOpen: boolean
  /** True until the player confirms a character once; the creator cannot be dismissed. */
  firstRun: boolean
  /** False when localStorage is unavailable, so nothing persists this session. */
  storageAvailable: boolean
  lastSave: SaveStatus | null
  openMenu: () => void
  cancel: () => void
  setName: (name: string) => void
  setPreset: (preset: PresetId) => void
  setTopColor: (index: number) => void
  /** Validates, saves and closes. Returns false if the draft is not valid. */
  confirm: () => boolean
}

const initial = loadCharacter()

/**
 * Character creator state. Only cosmetic data lives here; the physics body and
 * its position are never touched when these values change.
 */
export const useCharacterStore = create<CharacterStore>((set, get) => ({
  settings: initial.settings,
  draft: initial.settings,
  menuOpen: initial.firstRun,
  firstRun: initial.firstRun,
  storageAvailable: initial.storageAvailable,
  lastSave: null,

  openMenu: () => set((s) => ({ menuOpen: true, draft: s.settings })),

  cancel: () => set((s) => (s.firstRun ? s : { menuOpen: false, draft: s.settings })),

  setName: (name) =>
    // Light filtering while typing (keep trailing spaces); full sanitising on confirm.
    set((s) => ({
      draft: { ...s.draft, name: name.replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 16) },
    })),

  setPreset: (preset) =>
    set((s) =>
      s.draft.preset === preset ? s : { draft: { ...s.draft, preset, topColor: 0 } },
    ),

  setTopColor: (index) =>
    set((s) => {
      const max = Math.min(TOP_COLOR_COUNT, getPreset(s.draft.preset).topColors.length)
      if (!Number.isInteger(index) || index < 0 || index >= max) return s
      return { draft: { ...s.draft, topColor: index } }
    }),

  confirm: () => {
    const { draft } = get()
    const name = sanitizeName(draft.name)
    if (!isValidName(name)) return false
    const next: CharacterSettings = { ...draft, name }
    const lastSave = saveCharacter(next)
    set({ settings: next, draft: next, menuOpen: false, firstRun: false, lastSave })
    return true
  },
}))
