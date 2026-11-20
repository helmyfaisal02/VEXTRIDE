import {
  DEFAULT_SETTINGS,
  isPresetId,
  TOP_COLOR_COUNT,
  type CharacterSettings,
} from './presets'

/**
 * Guest character persistence. One versioned JSON record in localStorage:
 *
 *   { "version": 1, "character": { "name": "...", "preset": "...", "topColor": 0 } }
 *
 * Everything read back is validated. Bad, missing or unavailable storage never
 * throws; the caller simply gets the defaults and (for first runs) the creator.
 */

export const STORAGE_KEY = 'vextride:guest:character'
export const STORAGE_VERSION = 1
export const NAME_MIN = 2
export const NAME_MAX = 16

/** The subset of the Web Storage API used here (also what tests fake). */
export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/** Returns localStorage, or null when it is missing or blocked (privacy modes, sandboxed frames). */
export function getStorage(): StorageLike | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    return window.localStorage
  } catch {
    return null
  }
}

/** Keeps letters, digits, spaces, `_` and `-`; collapses spaces; trims; caps the length. */
export function sanitizeName(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  return raw
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N} _-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NAME_MAX)
    .trim()
}

export function isValidName(name: string): boolean {
  return sanitizeName(name) === name && name.length >= NAME_MIN && name.length <= NAME_MAX
}

/** Returns validated settings, or null if any field is wrong. Never repairs silently. */
export function validateSettings(value: unknown): CharacterSettings | null {
  if (typeof value !== 'object' || value === null) return null
  const v = value as Record<string, unknown>
  if (typeof v.name !== 'string' || !isValidName(v.name)) return null
  if (!isPresetId(v.preset)) return null
  if (
    typeof v.topColor !== 'number' ||
    !Number.isInteger(v.topColor) ||
    v.topColor < 0 ||
    v.topColor >= TOP_COLOR_COUNT
  ) {
    return null
  }
  return { name: v.name, preset: v.preset, topColor: v.topColor }
}

export type ParseResult =
  | { ok: true; settings: CharacterSettings }
  | { ok: false; reason: 'empty' | 'corrupt' | 'invalid' | 'newer-version' }

export function parseStoredCharacter(raw: string | null): ParseResult {
  if (raw === null || raw === '') return { ok: false, reason: 'empty' }
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return { ok: false, reason: 'corrupt' }
  }
  if (typeof data !== 'object' || data === null) return { ok: false, reason: 'corrupt' }
  const record = data as Record<string, unknown>
  if (typeof record.version !== 'number' || !Number.isInteger(record.version)) {
    return { ok: false, reason: 'invalid' }
  }
  if (record.version > STORAGE_VERSION) return { ok: false, reason: 'newer-version' }
  if (record.version !== STORAGE_VERSION) return { ok: false, reason: 'invalid' }
  const settings = validateSettings(record.character)
  return settings ? { ok: true, settings } : { ok: false, reason: 'invalid' }
}

export interface LoadResult {
  settings: CharacterSettings
  /** True when there is no usable saved character, so the creator should open. */
  firstRun: boolean
  /** False when localStorage is unavailable, so nothing can be saved this session. */
  storageAvailable: boolean
}

export function loadCharacter(storage: StorageLike | null = getStorage()): LoadResult {
  if (!storage) {
    return { settings: { ...DEFAULT_SETTINGS }, firstRun: true, storageAvailable: false }
  }
  let raw: string | null = null
  try {
    raw = storage.getItem(STORAGE_KEY)
  } catch {
    return { settings: { ...DEFAULT_SETTINGS }, firstRun: true, storageAvailable: false }
  }
  const parsed = parseStoredCharacter(raw)
  if (parsed.ok) return { settings: parsed.settings, firstRun: false, storageAvailable: true }
  return { settings: { ...DEFAULT_SETTINGS }, firstRun: true, storageAvailable: true }
}

export type SaveStatus = 'saved' | 'unavailable' | 'blocked' | 'error'

/**
 * Saves the character. Refuses (`blocked`) to overwrite a record written by a
 * newer version of the game, and refuses to write invalid settings.
 */
export function saveCharacter(
  settings: CharacterSettings,
  storage: StorageLike | null = getStorage(),
): SaveStatus {
  if (!storage) return 'unavailable'
  if (!validateSettings(settings)) return 'error'
  try {
    const existing = parseStoredCharacter(storage.getItem(STORAGE_KEY))
    if (!existing.ok && existing.reason === 'newer-version') return 'blocked'
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: STORAGE_VERSION, character: settings }),
    )
    return 'saved'
  } catch {
    return 'error'
  }
}
