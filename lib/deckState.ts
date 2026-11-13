'use client'

/**
 * Stage-state handoff for "return to the previous page".
 *
 * DeckStage mirrors its position + open card into sessionStorage as it runs.
 * A back/forward pop that lands on home restores the last mirrored state
 * (browser back after opening a post from the transmissions card returns to
 * that card, open); a fresh push to home (nav link, typed URL) does not.
 * The pop is detected here, module-level, before the home page remounts.
 */
const KEY = 'deck-state'

let poppedToHome = false

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    if (window.location.pathname === '/') poppedToHome = true
  })
}

export type DeckState = { pos: number; open: number }

export function saveDeckState(state: DeckState) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* storage unavailable — the restore is simply skipped */
  }
}

export function readDeckState(): DeckState | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const state = JSON.parse(raw) as DeckState
    return typeof state.pos === 'number' && typeof state.open === 'number' ? state : null
  } catch {
    return null
  }
}

/** true exactly once per history pop that landed on home. */
export function consumePoppedToHome(): boolean {
  const was = poppedToHome
  poppedToHome = false
  return was
}
