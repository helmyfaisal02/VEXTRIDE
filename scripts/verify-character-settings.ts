/**
 * Verifies character presets, validation and guest persistence, including the
 * real character store running against a fake localStorage. Run with
 * `bun run verify:settings`.
 */
import {
  getStorage,
  isValidName,
  loadCharacter,
  parseStoredCharacter,
  sanitizeName,
  saveCharacter,
  STORAGE_KEY,
  STORAGE_VERSION,
  type StorageLike,
} from '../src/game/character/persistence'
import {
  DEFAULT_SETTINGS,
  PRESETS,
  resolveAppearance,
  TOP_COLOR_COUNT,
  type CharacterSettings,
} from '../src/game/character/presets'

let fails = 0
const check = (name: string, ok: boolean, info = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${info}`)
  if (!ok) fails++
}

class MemoryStorage implements StorageLike {
  data = new Map<string, string>()
  getItem(key: string) { return this.data.get(key) ?? null }
  setItem(key: string, value: string) { this.data.set(key, value) }
}
const record = (character: unknown, version: unknown = STORAGE_VERSION) => JSON.stringify({ version, character })
const good: CharacterSettings = { name: 'Ace', preset: 'street-red', topColor: 2 }

/* ------------------------------- presets ---------------------------------- */
check('three presets', PRESETS.length === 3)
check('preset names match the spec', PRESETS.map((p) => p.name).join('|') === 'Urban Blue|Street Red|Metro Green')
check('preset ids are unique', new Set(PRESETS.map((p) => p.id)).size === 3)
check('preset outfits are distinct', new Set(PRESETS.map((p) => `${p.top}/${p.bottom}/${p.headwear}`)).size === 3)
const hex = /^#[0-9a-f]{6}$/i
check('every preset offers 4 valid clothing colours', PRESETS.every((p) => p.topColors.length === TOP_COLOR_COUNT && p.topColors.every((c) => hex.test(c.hex))))
let allResolve = true
for (const p of PRESETS) for (let i = 0; i < TOP_COLOR_COUNT; i++) {
  const colors = resolveAppearance({ name: 'X1', preset: p.id, topColor: i }).colors
  if (!(Object.values(colors) as string[]).every((c) => hex.test(c))) allResolve = false
}
check('every preset/colour combination resolves to valid hex colours', allResolve)
check('out-of-range colour index falls back to the signature colour', resolveAppearance({ name: 'X1', preset: 'urban-blue', topColor: 99 }).colors.top === PRESETS[0].topColors[0].hex)

/* ---------------------------------- names --------------------------------- */
check('sanitize strips markup and symbols', sanitizeName('<b>Ace</b>!') === 'bAceb')
check('sanitize collapses and trims spaces', sanitizeName('  Ace   Ventura ') === 'Ace Ventura')
check('sanitize caps at 16 characters', sanitizeName('abcdefghijklmnopqrstuvwxyz').length === 16)
check('sanitize rejects non-strings', sanitizeName(42) === '' && sanitizeName(null) === '')
check('1-char name invalid, 2-char valid', !isValidName('A') && isValidName('Al'))
check('name with symbols invalid', !isValidName('Ace<3'))
check('unicode letters allowed', isValidName('Zoë'))

/* --------------------------------- parsing -------------------------------- */
const reason = (raw: string | null) => { const r = parseStoredCharacter(raw); return r.ok ? 'ok' : r.reason }
check('valid record parses', reason(record(good)) === 'ok')
check('null is empty', reason(null) === 'empty')
check('garbage is corrupt', reason('not json{') === 'corrupt' && reason('"str"') === 'corrupt' && reason('null') === 'corrupt')
check('array / missing version is invalid', reason('[]') === 'invalid' && reason(JSON.stringify({ character: good })) === 'invalid')
check('newer version is flagged', reason(record(good, 2)) === 'newer-version')
check('old/unknown version is invalid', reason(record(good, 0)) === 'invalid' && reason(record(good, '1')) === 'invalid')
check('missing character is invalid', reason(JSON.stringify({ version: 1 })) === 'invalid')
check('unknown preset is invalid', reason(record({ ...good, preset: 'neon-pink' })) === 'invalid')
for (const bad of [4, -1, 1.5, '1', null, Number.NaN]) {
  check(`bad topColor ${String(bad)} is invalid`, reason(record({ ...good, topColor: bad })) === 'invalid')
}
check('bad names are invalid', reason(record({ ...good, name: '<script>' })) === 'invalid' && reason(record({ ...good, name: 'A' })) === 'invalid' && reason(record({ ...good, name: 7 })) === 'invalid')
{ const r = parseStoredCharacter(record({ ...good, extra: 'ignored' })); check('unknown extra fields are dropped', r.ok && !('extra' in r.settings)) }

/* ----------------------------- load / save -------------------------------- */
{ const s = new MemoryStorage(); const r = loadCharacter(s)
  check('empty storage: first run with defaults', r.firstRun && r.storageAvailable && r.settings.preset === DEFAULT_SETTINGS.preset) }
{ const s = new MemoryStorage(); check('save reports saved', saveCharacter(good, s) === 'saved')
  const raw = JSON.parse(s.getItem(STORAGE_KEY)!) as { version: number; character: { name: string } }
  check('saved record is versioned', raw.version === STORAGE_VERSION && raw.character.name === 'Ace')
  const r = loadCharacter(s); check('returning player resumes saved character', !r.firstRun && JSON.stringify(r.settings) === JSON.stringify(good)) }
{ const s = new MemoryStorage(); s.setItem(STORAGE_KEY, '{broken'); const r = loadCharacter(s)
  check('corrupt record falls back to defaults + creator', r.firstRun && r.settings.name === DEFAULT_SETTINGS.name)
  check('corrupt record is not touched by loading', s.getItem(STORAGE_KEY) === '{broken')
  check('user can overwrite a corrupt record by confirming', saveCharacter(good, s) === 'saved' && loadCharacter(s).settings.name === 'Ace') }
{ const s = new MemoryStorage(); const future = record(good, 2); s.setItem(STORAGE_KEY, future)
  check('save refuses to overwrite a newer-version record', saveCharacter({ ...good, name: 'Zed' }, s) === 'blocked' && s.getItem(STORAGE_KEY) === future) }
{ const s = new MemoryStorage(); check('invalid settings are never written', saveCharacter({ ...good, topColor: 9 }, s) === 'error' && s.getItem(STORAGE_KEY) === null) }
{ const throwing: StorageLike = { getItem() { throw new Error('denied') }, setItem() { throw new Error('quota') } }
  const r = loadCharacter(throwing)
  check('throwing getItem is handled', r.firstRun && !r.storageAvailable)
  check('throwing setItem is handled', saveCharacter(good, throwing) === 'error')
  const quota: StorageLike = { getItem: () => null, setItem() { throw new Error('QuotaExceeded') } }
  check('quota error on save is handled', saveCharacter(good, quota) === 'error') }
{ const r = loadCharacter(null); check('no storage at all is handled', r.firstRun && !r.storageAvailable && saveCharacter(good, null) === 'unavailable') }
check('getStorage is safe outside a browser', getStorage() === null)

/* --------------------- the real store on a fake localStorage ---------------- */
{
  const fake = new MemoryStorage()
  ;(globalThis as { window?: unknown }).window = { localStorage: fake }
  const { useCharacterStore } = await import('../src/game/state/characterStore')
  const st = () => useCharacterStore.getState()
  check('store: first launch opens the creator and it cannot be cancelled', st().menuOpen && st().firstRun && (st().cancel(), st().menuOpen))
  check('store: invalid draft cannot be confirmed', (st().setName('A'), !st().confirm()) && st().menuOpen && fake.getItem(STORAGE_KEY) === null)
  st().setName('Ace<>!')
  check('store: name is filtered while typing', st().draft.name === 'Ace')
  st().setPreset('street-red'); st().setTopColor(2); st().setTopColor(9)
  check('store: preset + colour update the draft, bad colour ignored', st().draft.preset === 'street-red' && st().draft.topColor === 2)
  check('store: draft does not change the committed character', st().settings.preset === DEFAULT_SETTINGS.preset)
  st().setPreset('metro-green')
  check('store: changing preset resets the colour index', st().draft.topColor === 0)
  st().setPreset('street-red'); st().setTopColor(2)
  check('store: confirm saves and closes', st().confirm() && !st().menuOpen && !st().firstRun && st().lastSave === 'saved')
  check('store: persisted record matches', JSON.stringify(parseStoredCharacter(fake.getItem(STORAGE_KEY))) === JSON.stringify({ ok: true, settings: { name: 'Ace', preset: 'street-red', topColor: 2 } }))
  st().openMenu(); st().setPreset('urban-blue'); st().setName('Bob')
  check('store: reopening edits a draft; cancel reverts it', (st().cancel(), !st().menuOpen && st().settings.preset === 'street-red' && st().draft.name === 'Ace'))
  check('store: saved data survives a reload (fresh load)', loadCharacter(fake).settings.name === 'Ace' && !loadCharacter(fake).firstRun)
}

console.log(fails === 0 ? 'ALL PASS' : `${fails} FAILED`)
process.exit(fails ? 1 : 0)
