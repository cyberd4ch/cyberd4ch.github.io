'use client'

import { useEffect } from 'react'
import { fleetBus } from '@/lib/fleetBus'
import { saveDeckState, readDeckState, consumePoppedToHome } from '@/lib/deckState'

/**
 * The presentation stage — phones only (html[data-stage] in globals.css).
 * Takes the home page's mobile flow over entirely: the document NEVER
 * scrolls, and the whole story lives on one continuous position `pos` in
 * 0..N (N chapters ⇒ 0 = the portrait, k = chapter k's card, collapsed).
 *
 * Gestures move pos; the screen itself never moves:
 *
 *   touch     — 1:1 drag scrub; release springs to the nearest stop with
 *               the release velocity folded into the target (fling-aware)
 *   wheel     — accumulates like touch; 160ms of quiet idle-snaps to the
 *               nearest stop (desktop/QA path)
 *   keys      — ArrowDown/Up/PageUp/Space step a stop at a time
 *   button    — each card's drawer button opens/closes the sheet
 *
 * Both ends rubber-band and there is NO release/unlock: the user can always
 * pull back to the landing area. Pulling past the last card springs home.
 *
 * Rendering (per frame, from the eased position):
 *
 *   portrait  — disperses continuously: formedTarget = 1 − distance from 0,
 *               so the face melts apart as the first card approaches and
 *               stays dispersed while any card is up
 *   cards     — each mounted card rides a translate/scale mapped from pos:
 *               it rises from below as pos crosses into it, slides up out
 *               as pos crosses past it, and the outgoing card eases back
 *               (scale + shadow) under the incoming one
 *   drawer    — a second spring (stiffness 180 / damping 20, a touch of
 *               overshoot) drives --cardP on the shown card: the sheet
 *               clips open bottom-up from the bar and the children stagger
 *               in via the CSS formula. Any scrub auto-collapses it.
 *   flight    — fleetBus.y rides pos linearly; FlightCanvas multiplies it
 *               (parallax) so the aircraft flies a longer route than the
 *               screen — the flight path seems to leave the landing area
 *
 * A drag that starts inside an OPEN card's body scrolls the body, until the
 * body hits its edge and the stage takes the gesture back.
 */

const WHEEL_PX_PER_POS = 110 // one wheel notch ≈ one card (QA STEP=360 ⇒ deltaY≈120)
const SNAP_IDLE = 160 // ms of wheel quiet before the idle-snap engages
const FLING_LEAD = 0.18 // s of release velocity folded into the spring target
const RESIST = 0.32 // rubber-band stiffness past the ends
// springs (per-second constants, semi-implicit Euler):
const P_K = 170 // deck spring — near-critical, scrubs settle crisply
const P_C = 24
const D_K = 180 // drawer spring — ζ≈0.75, a slight watermelon overshoot
const D_C = 20

export default function DeckStage() {
  useEffect(() => {
    const root = document.documentElement
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const mq = window.matchMedia('(max-width: 767.98px)')
    let enabled = false
    let dead = false
    let chapters: HTMLElement[] = []
    let mounted = new Set<number>() // chapter indices currently displayed
    let N = 0
    let posPx = 300 // px of drag per pos unit (1:1 scrub gearing)

    // ---- continuous pos state ---------------------------------------------
    let raw = 0 // un-rubber-banded position (source of truth)
    let target = 0 // spring destination
    let vel = 0 // spring velocity (pos/s)
    let springing = false
    let shown = 0 // chapter index currently "current" (0 = portrait)
    // drawer
    let d = 0 // sheet position 0..1 on the shown card
    let dTarget = 0
    let dVel = 0
    let dSpringing = false
    let lastWheel = 0
    let raf = 0
    let lastT = 0
    // peek-bar affordance: the landing renders chapter 1's bar before any
    // card is mounted (pos 0 shows none). Clicking that bar's toggle springs
    // the deck to the card's stop and opens its sheet on arrival.
    let pendingStop = 0
    let pendingOpen = false
    let lastPosAttr = -1
    // landing sheet: the mission brief opens IN PLACE over the portrait —
    // the deck does not advance, the fleet stays formed, no patch plays in
    // a gap because no gap exists. Closed → the card unmounts, landing again.
    let landingSheet = false
    let landingStop = 1 // the chapter whose sheet is open in place

    // touch gesture
    let tracking = false
    let startY = 0
    let startRaw = 0
    let lastY = 0
    let nestBody: HTMLElement | null = null
    let vSamples: { t: number; p: number }[] = []

    const clampPos = (v: number) => Math.max(0, Math.min(N, v))

    const measure = () => {
      const vh = window.innerHeight
      posPx = Math.max(180, Math.round(vh * 0.52))
      // the story is virtual: N stops × posPx px of travel (the document
      // never scrolls, so nothing on it measures the ride)
      fleetBus.spanPx = Math.max(1, N * posPx)
    }

    // ---- chapter mounting -----------------------------------------------------
    // chapters are logical stops 1..N (the hero is not a chapter), but the
    // NodeList is 0-based — every accessor maps stop i → array slot i−1
    const chapterEl = (i: number) => chapters[i - 1] ?? null
    const cardEl = (i: number) => chapterEl(i)?.querySelector<HTMLElement>('.deck-card') ?? null

    const showChapter = (i: number) => {
      if (mounted.has(i)) return
      chapterEl(i)?.classList.add('chapter-on')
      // layer promotion is granted per mounted card and revoked on hide —
      // a CSS blanket will-change promoted all 9 full-viewport layers at
      // once (tens of MB of graphics memory on phones)
      const card = cardEl(i)
      if (card) card.style.willChange = 'transform'
      mounted.add(i)
    }
    const hideChapter = (i: number) => {
      if (!mounted.has(i)) return
      const el = chapterEl(i)
      el.classList.remove('chapter-on')
      const card = cardEl(i)
      if (card) {
        card.style.transform = ''
        card.style.zIndex = ''
        card.style.willChange = ''
        card.removeAttribute('data-open')
        card.style.setProperty('--cardP', '0')
      }
      mounted.delete(i)
    }

    const setDrawer = (v: number) => {
      dTarget = Math.max(0, Math.min(1, v))
      dSpringing = true
    }
    const collapseDrawer = () => {
      if (dTarget !== 0 || d !== 0) {
        dTarget = 0
        dSpringing = true
      }
    }

    const springTo = (t: number) => {
      target = clampPos(t)
      springing = true
      lastWheel = 0
    }

    // release velocity (pos/s) from the recent touch samples
    const velocity = () => {
      const now = performance.now()
      vSamples = vSamples.filter(s => now - s.t < 100)
      if (vSamples.length < 2) return 0
      const a = vSamples[0]
      const b = vSamples[vSamples.length - 1]
      const dt = (b.t - a.t) / 1000
      return dt > 0.012 ? (b.p - a.p) / dt : 0
    }

    // ---- the frame loop ---------------------------------------------------------
    const frame = (now: number) => {
      if (dead || !enabled) return
      raf = requestAnimationFrame(frame)
      const dt = Math.min(0.05, lastT ? (now - lastT) / 1000 : 0.016)
      lastT = now

      // wheel went quiet: idle-snap to the nearest stop
      if (!springing && !tracking && lastWheel && now - lastWheel > SNAP_IDLE) {
        springTo(Math.round(raw))
      }

      // deck spring (semi-implicit Euler; ζ≈0.92 — crisp, tiny overshoot)
      if (springing) {
        const a = (target - raw) * P_K - vel * P_C
        vel += a * dt
        raw += vel * dt
        if (Math.abs(target - raw) < 0.0025 && Math.abs(vel) < 0.02) {
          raw = target
          vel = 0
          springing = false
        }
      }

      // drawer spring (ζ≈0.75 — a soft watermelon overshoot)
      if (dSpringing) {
        const a = (dTarget - d) * D_K - dVel * D_C
        dVel += a * dt
        d += dVel * dt
        d = Math.max(-0.04, Math.min(1.04, d)) // let it overshoot just past the stops
        if (Math.abs(dTarget - d) < 0.0025 && Math.abs(dVel) < 0.03) {
          d = dTarget
          dVel = 0
          dSpringing = false
        }
      }

      // the landing sheet closed fully: unmount the mission brief, landing again
      if (landingSheet && shown === 0 && !dSpringing && d === 0 && dTarget === 0) {
        landingSheet = false
        hideChapter(landingStop)
      }

      // render position (rubber-banded at both ends; no unlock, ever)
      const p = raw < 0 ? raw * RESIST : raw > N ? N + (raw - N) * RESIST : raw

      // flight + formation ride the same dial
      const y = p * posPx
      if (Math.abs(y - fleetBus.y) > 0.01) fleetBus.y = y
      fleetBus.formedTarget = Math.max(0, Math.min(1, 1 - p))
      // only the OPEN SHEET truly covers the art area (the collapsed card is
      // just its bottom bar — the flight layer's story patch lives in the
      // void above it). While the sheet is open both canvases skip their
      // heavy paint loops; any other state keeps them live: mid-scrub the
      // cards part and the patches play in the gap between them.
      fleetBus.covered = d > 0.95

      // which card is current
      const idx = Math.max(0, Math.min(N, Math.round(p)))
      if (idx !== shown) {
        shown = idx
        // scrubbing away from the landing with the in-place sheet up ends
        // the landing (the gesture already collapsed the drawer)
        if (landingSheet && shown !== 0) landingSheet = false
        // arriving at a card: it starts collapsed (fresh sheet)
        d = 0
        dTarget = 0
        dVel = 0
        dSpringing = false
        saveDeckState({ pos: shown, open: 0 })
      }
      // the landing peek bar only exists at pos 0 (CSS keys off data-pos)
      if (idx !== lastPosAttr) {
        lastPosAttr = idx
        root.dataset.pos = String(idx)
      }

      // a peek-bar click has arrived and settled at its stop: open the sheet
      // now (the arrival reset above cleared the drawer first)
      if (pendingOpen && shown === pendingStop && !springing) {
        pendingOpen = false
        setDrawer(1)
      }

      // mount window: |p − i| < 1 keeps at most the incoming + outgoing pair
      for (let i = 1; i <= N; i++) {
        if ((landingSheet && i === landingStop) || (p > i - 1 && p < i + 1)) showChapter(i)
        else hideChapter(i)
      }

      // card transforms: rise from below on enter, slide up out on exit
      const vh = window.innerHeight
      const ride = vh * 1.04
      for (const i of mounted) {
        const card = cardEl(i)
        if (!card) continue
        if (landingSheet && shown === 0 && i === landingStop) {
          // the in-place landing sheet holds its CSS bottom-sheet posture —
          // no ride transform (the deck is parked at pos 0; the portrait
          // stays formed behind it). The drawer spring drives the sheet.
          card.style.zIndex = String(30 + i)
          card.style.setProperty('--cardP', d.toFixed(4))
          const open = d > 0.995 && dTarget === 1
          if (open !== card.hasAttribute('data-open')) {
            if (open) card.setAttribute('data-open', '')
            else card.removeAttribute('data-open')
            const btn = card.querySelector<HTMLButtonElement>('.deck-toggle')
            if (btn) btn.setAttribute('aria-expanded', String(open))
            saveDeckState({ pos: 0, open: open ? landingStop : 0 })
          }
          continue
        }
        const e = Math.max(0, Math.min(1, p - (i - 1))) // enter 0..1
        const x = Math.max(0, Math.min(1, p - i)) // exit 0..1
        const ty = (1 - e) * ride - x * ride
        const s = 1 - 0.05 * x
        card.style.transform = `translate3d(0, ${ty.toFixed(1)}px, 0) scale(${s.toFixed(3)})`
        card.style.zIndex = String(30 + i)
        if (i === shown) {
          card.style.setProperty('--cardP', d.toFixed(4))
          const open = d > 0.995 && dTarget === 1
          if (open !== card.hasAttribute('data-open')) {
            if (open) card.setAttribute('data-open', '')
            else card.removeAttribute('data-open')
            const btn = card.querySelector<HTMLButtonElement>('.deck-toggle')
            if (btn) btn.setAttribute('aria-expanded', String(open))
            saveDeckState({ pos: shown, open: open ? shown : 0 })
          }
        }
      }
    }

    // ---- lifecycle ---------------------------------------------------------------
    const disable = () => {
      if (!enabled) return
      enabled = false
      cancelAnimationFrame(raf)
      for (const i of Array.from(mounted)) hideChapter(i) // reset card styles too
      mounted.clear()
      chapters.forEach(el => el.classList.remove('chapter-on'))
      pendingStop = 0
      pendingOpen = false
      landingSheet = false
      landingStop = 1
      delete root.dataset.pos
      delete root.dataset.stage
      fleetBus.resetStage()
    }

    const enable = () => {
      chapters = Array.from(document.querySelectorAll<HTMLElement>('.chapter'))
      if (chapters.length < 1 || enabled) return
      N = chapters.length
      enabled = true
      root.dataset.stage = 'on'
      fleetBus.virtual = true
      fleetBus.formedTarget = 1
      fleetBus.y = 0
      fleetBus.lastInput = performance.now()
      raw = 0
      target = 0
      vel = 0
      springing = false
      d = 0
      dTarget = 0
      dVel = 0
      dSpringing = false
      shown = 0
      lastPosAttr = -1
      mounted.clear()
      window.scrollTo(0, 0)
      measure()
      // a history pop landed back on home: restore the mirrored stage state —
      // back from a post opened inside the transmissions card returns to that
      // card, open; back from a post opened in the landing sheet returns to
      // the landing with the mission brief open. Fresh pushes to home (nav
      // links, typed URLs) never restore.
      landingSheet = false
      const saved = consumePoppedToHome() ? readDeckState() : null
      if (saved && saved.pos === 0 && saved.open > 0) {
        landingSheet = true
        landingStop = saved.open
        showChapter(landingStop)
        setDrawer(1)
      } else if (saved && saved.pos > 0) {
        springTo(saved.pos)
        if (saved.open === saved.pos) {
          pendingStop = saved.pos
          pendingOpen = true
        }
      }
      lastT = performance.now()
      raf = requestAnimationFrame(frame)
    }

    // ---- gestures ----------------------------------------------------------------
    const onTouchStart = (e: TouchEvent) => {
      if (!enabled) return
      fleetBus.lastInput = performance.now()
      tracking = true
      springing = false
      lastWheel = 0
      pendingOpen = false // any touch takes the gesture back from a peek click
      startY = e.touches[0].clientY
      lastY = startY
      startRaw = raw
      vSamples = []
      nestBody = null
      const el = e.target as Element | null
      const body = el?.closest?.('.deck-body') as HTMLElement | null
      // the body only takes over when the drawer is (almost) fully open —
      // mid-reveal drags belong to the scrub
      if (body && d > 0.9 && body.scrollHeight > body.clientHeight + 4) nestBody = body
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!enabled) return
      if (!tracking) {
        e.preventDefault() // a stray second finger never scrolls the page
        return
      }
      fleetBus.lastInput = performance.now()
      const y = e.touches[0].clientY
      const dy = lastY - y // positive = swiping up = "scroll down"
      lastY = y
      if (nestBody) {
        const b = nestBody
        const canDown = b.scrollTop + b.clientHeight < b.scrollHeight - 2
        const canUp = b.scrollTop > 2
        if ((dy > 0 && canDown) || (dy < 0 && canUp)) return // the body consumes it
        nestBody = null // body at its edge — the stage takes over, drawer closes
        collapseDrawer()
      }
      e.preventDefault()
      // any scrub collapses the drawer — scrubbing moves cards, never sheets
      collapseDrawer()
      raw = startRaw + (startY - y) / posPx
      vSamples.push({ t: performance.now(), p: raw })
      if (vSamples.length > 10) vSamples.shift()
    }

    const onTouchEnd = () => {
      if (!tracking) return
      tracking = false
      nestBody = null
      if (!enabled) return
      // fling: fold release velocity into the spring target
      const fling = raw + velocity() * FLING_LEAD
      // past the ends the rubber-band snaps home; inside, the fling rounds to
      // the nearest stop first (a fast short swipe advances a card)
      const goal = fling < 0 || fling > N ? clampPos(fling) : Math.round(fling)
      springTo(goal)
    }

    const onWheel = (e: WheelEvent) => {
      if (!enabled || tracking) return
      e.preventDefault()
      fleetBus.lastInput = performance.now()
      pendingOpen = false
      collapseDrawer()
      springing = false
      const dy =
        e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * window.innerHeight : e.deltaY
      raw += dy / WHEEL_PX_PER_POS
      lastWheel = performance.now()
    }

    const onKey = (e: KeyboardEvent) => {
      if (!enabled) return
      const down = e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' '
      const up = e.key === 'ArrowUp' || e.key === 'PageUp'
      if (!down && !up) return
      e.preventDefault()
      fleetBus.lastInput = performance.now()
      pendingOpen = false
      collapseDrawer()
      springTo(Math.round(raw) + (down ? 1 : -1))
    }

    const onToggleClick = (e: MouseEvent) => {
      if (!enabled) return
      const btn = (e.target as Element | null)?.closest?.('.deck-toggle')
      if (!btn) return
      e.preventDefault()
      fleetBus.lastInput = performance.now()
      // the landing peek bar's card is not mounted (no sheet exists yet at
      // pos 0) — the landing gate below opens it in place instead. Gated to
      // the landing: mid-scrub taps on the always-rendered ghost bar must
      // not yank the deck around.
      const chap = btn.closest('.chapter')
      const stop = chap ? chapters.indexOf(chap as HTMLElement) + 1 : 0
      if (shown === 0 && stop > 0 && chap && !chap.classList.contains('chapter-on')) {
        // the landing peek bar: open that card's sheet IN PLACE — the deck
        // stays at pos 0, the fleet stays formed behind the sheet, no story
        // patch plays (no gap ever opens). Closing it unmounts the card and
        // lands again (frame loop); scrubbing away ends the landing.
        landingSheet = true
        landingStop = stop
        showChapter(stop)
        setDrawer(1)
        return
      }
      setDrawer(dTarget === 0 ? 1 : 0)
    }

    const onResize = () => {
      if (!enabled) return
      measure()
    }

    const onVis = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf)
        lastT = 0
      } else if (enabled && !dead) {
        lastT = performance.now()
        raf = requestAnimationFrame(frame)
      }
    }

    const onMq = () => {
      if (mq.matches) enable()
      else disable()
    }
    onMq()
    mq.addEventListener?.('change', onMq)
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    window.addEventListener('touchcancel', onTouchEnd, { passive: true })
    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', onKey)
    window.addEventListener('click', onToggleClick)
    window.addEventListener('resize', onResize)
    document.addEventListener('visibilitychange', onVis)

    return () => {
      dead = true
      mq.removeEventListener?.('change', onMq)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('touchcancel', onTouchEnd)
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('click', onToggleClick)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVis)
      disable()
    }
  }, [])

  return null
}
