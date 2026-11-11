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
  kick(x: number, y: number, r: number, hit: number) {
    if (this.kicks.length < 10) this.kicks.push({ x, y, r, hit })
  },
  drain(): Kick[] {
    const q = this.kicks
    if (q.length) this.kicks = []
    return q
  },
}
