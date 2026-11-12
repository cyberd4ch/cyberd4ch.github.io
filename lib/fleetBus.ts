/**
 * Shared flight-deck between the two fixed canvases: FlightCanvas needs to
 * know where the fleet's mini ships are (to strafe them while it flies),
 * and ShipCanvas needs the rocket's live pose (to upheave away from it)
 * plus any projectile impacts. Both canvases run their own rAF loops in the
 * same tab, so a tiny mutable singleton is the cheapest safe bus — no React
 * state, no DOM events at 60fps.
 */
export type FleetPing = { x: number; y: number; s: number }
export type Kick = { x: number; y: number; r: number; hit: number }

export const fleetBus = {
  /** mini-ship viewport positions, refreshed every fleet frame */
  ships: [] as FleetPing[],
  /** 1 = portrait fully formed, 0 = fully dispersed */
  formed: 1,
  /** live rocket pose (viewport space) + attack stance */
  rocket: { x: -1e4, y: -1e4, attacking: false },
  /** impact queue: FlightCanvas pushes, ShipCanvas drains */
  kicks: [] as Kick[],

  // ---- presentation stage (components/deck/DeckStage, phones only) ----------
  // when `virtual` is on the document never scrolls: FlightCanvas reads its
  // scroll position from `y` — tweened by DeckStage so the rocket still flies
  // as the user steps through cards — the fleet eases toward `formedTarget`
  // on the clock instead of being scrubbed by scroll, and `lastInput`
  // timestamps gate the portrait's idle facial gestures.
  virtual: false,
  y: 0,
  /** stage virtual travel: N stops × posPx (set by DeckStage.measure) */
  spanPx: 0,
  formedTarget: 1,
  lastInput: 0,

  kick(x: number, y: number, r: number, hit: number) {
    if (this.kicks.length < 10) this.kicks.push({ x, y, r, hit })
  },
  drain(): Kick[] {
    const q = this.kicks
    if (q.length) this.kicks = []
    return q
  },
  /** back to native scrolling — used by the stage teardown */
  resetStage() {
    this.virtual = false
    this.y = 0
    this.spanPx = 0
    this.formedTarget = 1
    this.lastInput = 0
  },
}
