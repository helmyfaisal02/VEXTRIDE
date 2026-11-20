import { memo, useId, type KeyboardEvent } from 'react'
import { Check, X } from 'lucide-react'
import { isValidName, NAME_MAX, NAME_MIN, sanitizeName } from '../character/persistence'
import { getPreset, PRESETS, type CharacterPreset } from '../character/presets'
import { useCharacterStore } from '../state/characterStore'

const NAVY = '#1B3158'

function PresetCard({ preset, selected }: { preset: CharacterPreset; selected: boolean }) {
  const setPreset = useCharacterStore((s) => s.setPreset)
  const topColor = useCharacterStore((s) => s.draft.topColor)
  const jacket = selected ? preset.topColors[topColor]?.hex : preset.topColors[0].hex

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={() => setPreset(preset.id)}
      className={`flex min-h-[64px] w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B3158] ${
        selected
          ? 'border-[#1B3158] bg-white shadow-[0_6px_20px_rgba(27,49,88,0.16)]'
          : 'border-white/60 bg-white/40 hover:bg-white/70'
      }`}
    >
      <span
        className="font-display w-7 text-sm font-bold tabular-nums opacity-60"
        style={{ letterSpacing: '0.06em' }}
      >
        {preset.number}
      </span>
      <span className="min-w-0 flex-1">
        <span className="font-display block text-[15px] font-bold leading-tight">{preset.name}</span>
        <span className="block truncate text-xs opacity-70">{preset.summary}</span>
      </span>
      <span className="flex shrink-0 -space-x-1" aria-hidden="true">
        {[jacket, preset.pants, preset.shoe].map((hex, i) => (
          <span
            key={i}
            className="h-4 w-4 rounded-full border border-[#1B3158]/20"
            style={{ background: hex }}
          />
        ))}
      </span>
    </button>
  )
}

function Swatches() {
  const presetId = useCharacterStore((s) => s.draft.preset)
  const topColor = useCharacterStore((s) => s.draft.topColor)
  const setTopColor = useCharacterStore((s) => s.setTopColor)
  const preset = getPreset(presetId)
  const label = { 'urban-blue': 'Jacket', 'street-red': 'Hoodie', 'metro-green': 'Jacket' }[preset.id]

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase opacity-70" style={{ letterSpacing: '0.1em' }}>
        {label} color &middot; {preset.topColors[topColor]?.name}
      </p>
      <div className="mt-1 flex gap-1.5">
        {preset.topColors.map((option, i) => (
          <button
            key={option.hex}
            type="button"
            aria-label={option.name}
            aria-pressed={topColor === i}
            onClick={() => setTopColor(i)}
            className="flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#1B3158]"
          >
            <span
              className={`block h-7 w-7 rounded-full border border-[#1B3158]/25 transition-transform ${
                topColor === i ? 'scale-110 ring-2 ring-[#1B3158] ring-offset-2 ring-offset-white' : ''
              }`}
              style={{ background: option.hex }}
            />
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * Character creator panel. The preview is the real player model in the game
 * canvas (see CharacterPreviewCamera); this panel only edits the draft.
 */
function CharacterCreatorImpl() {
  const nameId = useId()
  const hintId = useId()
  const name = useCharacterStore((s) => s.draft.name)
  const preset = useCharacterStore((s) => s.draft.preset)
  const firstRun = useCharacterStore((s) => s.firstRun)
  const storageAvailable = useCharacterStore((s) => s.storageAvailable)
  const setName = useCharacterStore((s) => s.setName)
  const confirm = useCharacterStore((s) => s.confirm)
  const cancel = useCharacterStore((s) => s.cancel)

  const cleanName = sanitizeName(name)
  const valid = isValidName(cleanName)

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape' && !firstRun) {
      e.preventDefault()
      cancel()
    } else if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
      e.preventDefault()
      if (valid) confirm()
    }
  }

  return (
    <section
      aria-label="Character creator"
      onKeyDown={onKeyDown}
      className="pointer-events-auto absolute inset-x-3 bottom-3 z-10 flex max-h-[56dvh] flex-col overflow-hidden rounded-3xl border border-white/60 bg-white/70 text-[#1B3158] shadow-[0_20px_60px_rgba(27,49,88,0.28)] backdrop-blur-xl md:inset-x-auto md:bottom-5 md:left-5 md:top-24 md:max-h-none md:w-[400px]"
    >
      <div className="flex-1 space-y-4 overflow-y-auto px-5 pb-3 pt-5">
        <header>
          <h2
            className="font-display text-[22px] font-bold leading-tight"
            style={{ letterSpacing: '-0.02em' }}
          >
            {firstRun ? 'Create Your Character' : 'Edit Your Character'}
          </h2>
          <p className="mt-0.5 text-xs opacity-70">Drag the preview to rotate. Scroll to zoom.</p>
        </header>

        <div>
          <label
            htmlFor={nameId}
            className="text-[11px] font-semibold uppercase opacity-70"
            style={{ letterSpacing: '0.1em' }}
          >
            Name
          </label>
          <input
            id={nameId}
            type="text"
            value={name}
            maxLength={NAME_MAX}
            autoComplete="off"
            autoCapitalize="words"
            spellCheck={false}
            placeholder="Player"
            aria-invalid={!valid}
            aria-describedby={hintId}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 h-11 w-full rounded-xl border border-white/70 bg-white/80 px-3 text-[15px] font-medium text-[#1B3158] outline-none transition-shadow placeholder:text-[#1B3158]/40 focus:border-[#1B3158] focus:shadow-[0_0_0_3px_rgba(27,49,88,0.15)]"
          />
          <p
            id={hintId}
            className={`mt-1 text-[11px] ${valid ? 'opacity-60' : 'font-semibold text-[#b3261e]'}`}
          >
            {NAME_MIN} to {NAME_MAX} letters, numbers, spaces, _ or -
          </p>
        </div>

        <div role="radiogroup" aria-label="Character preset" className="space-y-2">
          {PRESETS.map((p) => (
            <PresetCard key={p.id} preset={p} selected={p.id === preset} />
          ))}
        </div>

        <Swatches />
      </div>

      <footer className="space-y-2 border-t border-white/60 bg-white/50 px-5 py-4">
        {!storageAvailable && (
          <p className="text-[11px] opacity-70">
            Saving is unavailable in this browser, so your character resets on refresh.
          </p>
        )}
        <div className="flex gap-2">
          {!firstRun && (
            <button
              type="button"
              onClick={cancel}
              className="flex h-12 items-center gap-1.5 rounded-2xl border border-[#1B3158]/25 bg-white/60 px-4 text-sm font-semibold transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B3158]"
            >
              <X size={16} aria-hidden="true" />
              Cancel
            </button>
          )}
          <button
            type="button"
            disabled={!valid}
            onClick={() => confirm()}
            className="font-display flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl text-[15px] font-bold text-white transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B3158] disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: NAVY, letterSpacing: '0.02em' }}
          >
            <Check size={18} aria-hidden="true" />
            {firstRun ? 'Start Playing' : 'Save Character'}
          </button>
        </div>
      </footer>
    </section>
  )
}

export const CharacterCreator = memo(CharacterCreatorImpl)
