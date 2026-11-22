import { useLayoutEffect, type KeyboardEvent, type RefObject } from 'react'

const controls = 'a[href], button, input, select, textarea, summary, [tabindex]'

/** For game panels that leave the canvas visible, including the character preview. */
export function useModalFocus(
  panel: RefObject<HTMLElement>,
  initialFocus: RefObject<HTMLElement>,
  open = true,
  returnFocus?: RefObject<HTMLElement>,
) {
  useLayoutEffect(() => {
    const dialog = panel.current
    if (!open || !dialog) return
    const opener = returnFocus?.current ?? document.activeElement
    initialFocus.current?.focus({ preventScroll: true })
    return () => {
      // Wait for the background to lose its inert attribute. Strict Mode also
      // replays this effect with the same dialog still mounted.
      queueMicrotask(() => {
        const active = document.activeElement
        if (active && dialog.contains(active)) return
        if (opener instanceof HTMLElement && opener.isConnected && !opener.closest('[inert]')) {
          opener.focus({ preventScroll: true })
        }
      })
    }
  }, [panel, initialFocus, open, returnFocus])

  return (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Tab' || event.defaultPrevented) return
    const elements = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(controls)).filter(element =>
      element.tabIndex >= 0 && !element.matches(':disabled') && !element.closest('[inert]') &&
      element.getClientRects().length > 0 && getComputedStyle(element).visibility === 'visible',
    )
    const first = elements[0]
    const last = elements[elements.length - 1]
    const active = document.activeElement as HTMLElement | null
    if (!active || !elements.includes(active) || (event.shiftKey ? active === first : active === last)) {
      event.preventDefault()
      const next = event.shiftKey ? last : first
      next?.focus()
    }
  }
}
