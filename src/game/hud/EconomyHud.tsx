import { useEconomy,formatSC } from '../economy/economySelectors'
import { useCharacterStore } from '../state/characterStore'
export function EconomyHud(){
 const balance=useEconomy(s=>s.balance),creator=useCharacterStore(s=>s.menuOpen)
 if(creator)return null
 return <p className="pointer-events-none absolute left-5 top-[8.25rem] rounded-xl bg-[#142440]/90 px-3 py-1.5 text-xs font-semibold tabular-nums text-white sm:left-7" data-testid="street-cash" aria-live="polite">STREET CASH: {formatSC(balance)}</p>
}
