'use client'

import { useEffect, useRef } from 'react'
import { fleetBus } from '@/lib/fleetBus'

/**
 * The presentation stage — phones only (styled via html[data-stage] in
 * globals.css). Takes the home page's mobile flow over from the sticky card
 * deck: the document itself never scrolls (html/body locked, touchmove
 * prevented) and the whole story lives on a continuous scrub.
 *
 * One float drives everything — the beat position `raw` in 0..2N beats
 * (9 chapters ⇒ 18): even beats are the portrait, odd beat 2k+1 is chapter
 * k's card, fully open. Gestures move `raw` directly, so every animation is
 * scrubbed by the finger and stopping mid-gesture freezes the scene exactly
 * where it rolled to:
 *
 *   touch     — 1:1 drag scrub; release springs to the nearest beat, with
 *               the release velocity folding into which beat it picks
 *   wheel     — accumulates like touch; 160ms of quiet idle-snaps to the
 *               nearest beat (desktop/QA path)
 *   keys      — ArrowDown/Up/PageUp/Space spring a beat at a time
 *
 * While scrubbing, each frame maps the position onto the scene:
 *
 *   portrait  — dispersal is continuous: formedTarget = 1 − distance from
 *               the nearest even beat, so the face melts apart as the card
 *               approaches and re-forms between cards
 *   card      — the drawer (chapter panel + trailing meta) reveals bottom-up
 *               through a top-inset clip driven by --cardP (1 − distance
 *               from the nearest odd beat): halt mid-gesture and you see
 *               exactly that fraction of the drawer, trailing text first
 *   flight    — fleetBus.y rides pos linearly, so the rocket flies the route
 *               as the deck turns and docks at the final portrait
 *   propeller — rotation is scroll: pos deltas wind it clockwise scrolling
 *               down and counterclockwise up. It never spins on its own at
 *               rest, but it can be grabbed and spun (with inertia) whenever
 *               no scroll is happening.
 *
 * Pulling past the final portrait (beat 2N) rubber-bands, and releasing
 * there unlocks the page and hands back native scrolling (at the footer).
 * Drags that start inside a scrollable card panel scroll the panel instead,
 * until the panel hits its edge and the stage takes the gesture back.
 */

const TOUCH_PX_PER_BEAT = 64 // px of drag per beat — the 1:1 scrub gearing
const WHEEL_PX_PER_BEAT = 120 // one wheel notch ≈ one beat (QA STEP=360 ⇒ deltaY≈120)
const SNAP_IDLE = 160 // ms of wheel quiet before the idle-snap engages
const FLING_LEAD = 0.22 // s of release velocity folded into the snap target
const SPRING_RATE = 9 // 1/s — exponential approach rate (dt-based, device-agnostic)
const RESIST = 0.35 // rubber-band stiffness past the ends
const PROP_DEG_PER_BEAT = 300 // propeller wind-up per beat of scroll

export default function DeckStage() {
  const hostRef = useRef<HTMLDivElement>(null)
  const propRef = useRef<HTMLSpanElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const labelRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const root = document.documentElement
    const host = hostRef.current
    const prop = propRef.current
    const svg = svgRef.current
    const label = labelRef.current
    if (!host || !prop || !svg || !label) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const mq = window.matchMedia('(max-width: 767.98px)')
    let enabled = false
    let released = false
    let dead = false
    let chapters: HTMLElement[] = []
    let N = 0 // chapters; the beat dial runs 0..2N
    let spanPx = 1

    // ---- continuous scrub state ---------------------------------------------
    let raw = 0 // un-rubber-banded beat position (the source of truth)
    let target = 0 // spring destination
    let springing = false
    let settleRelease = false // spring lands on 2N because the user pulled past it
    let lastWheel = 0
    let raf = 0
    let lastT = 0
    let lastPos = 0
    let shown = -1 // chapter index currently mounted, -1 = none
    let lastP = -1 // last --cardP value written to the shown chapter

    // touch gesture
    let tracking = false
    let startY = 0
    let startRaw = 0
    let lastY = 0
    let nestPanel: HTMLElement | null = null
    let vSamples: { t: number; p: number }[] = []

    // propeller drag + inertia
    let propDrag = false
    let propAngle = 0
    let propVel = 0 // deg/s after release
    let propDirty = true
    let propCx = 0
    let propCy = 0
    let propBase = 0 // angle when the drag started
    let propCont = 0 // accumulated unwrapped drag angle (rad)
    let prevA = 0 // continuous angle tracker
    let lastPropT = 0

    const clampBeat = (v: number) => Math.max(0, Math.min(2 * N, v))
    const rubber = (v: number) =>
      v < 0 ? v * RESIST : v > 2 * N ? 2 * N + (v - 2 * N) * RESIST : v

    const measure = () => {
      // the stage's chapters are fixed (out of flow), so the document
      // height is stable while enabled — hero + footer only
      spanPx = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
    }

    // ---- chapter mounting -----------------------------------------------------
    const showChapter = (i: number) => {
      chapters.forEach(c => {
        if (c !== chapters[i]) c.classList.remove('chapter-on')
      })
      chapters[i].classList.add('chapter-on')
    }
    const hideChapter = (i: number) => {
      chapters[i].classList.remove('chapter-on')
      chapters[i].style.removeProperty('--cardP')
    }

    const springTo = (t: number, settleRel = false) => {
      target = clampBeat(t)
      settleRelease = settleRel && raw > 2 * N
      springing = true
      lastWheel = 0
    }

    // release velocity (beats/s) from the recent touch samples
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
      if (dead || released) return
      raf = requestAnimationFrame(frame)
      const dt = Math.min(0.05, lastT ? (now - lastT) / 1000 : 0.016)
      lastT = now

      // wheel went quiet: idle-snap to the nearest beat
      if (!springing && !tracking && !propDrag && lastWheel && now - lastWheel > SNAP_IDLE) {
        springTo(Math.round(raw), raw > 2 * N)
      }

      if (springing) {
        const d = (target - raw) * (1 - Math.exp(-dt * SPRING_RATE))
        raw += d
        if (Math.abs(target - raw) < 0.002) {
          raw = target
          springing = false
          if (settleRelease) {
            release()
            return
          }
        }
      }

      // propeller inertia after a hand-spin
      if (!propDrag && propVel !== 0) {
        propAngle += propVel * dt
        propVel *= Math.exp(-dt * 2.4)
        if (Math.abs(propVel) < 6) propVel = 0
        propDirty = true
      }

      const pos = rubber(raw)

      // propeller rotation IS the scroll: clockwise down, counterclockwise up
      if (pos !== lastPos) {
        propAngle += (pos - lastPos) * PROP_DEG_PER_BEAT
        propDirty = true
        lastPos = pos
      }
      if (propDirty) {
        svg.style.transform = `rotate(${propAngle.toFixed(2)}deg)`
        propDirty = false
      }

      // flight + formation ride the same dial
      const y = (pos / (2 * N)) * spanPx
      if (Math.abs(y - fleetBus.y) > 0.01) fleetBus.y = y
      const dEven = Math.abs(pos - 2 * Math.round(pos / 2))
      fleetBus.formedTarget = Math.max(0, Math.min(1, 1 - dEven))

      // drawer reveal: nearest odd beat's chapter, opened by 1 − distance
      const k = Math.round((pos - 1) / 2)
      const odd = 2 * k + 1
      const cardP = Math.max(0, Math.min(1, 1 - Math.abs(pos - odd)))
      if (cardP > 0.001 && k >= 0 && k < N) {
        if (shown !== k) {
          showChapter(k)
          shown = k
          lastP = -1
        }
        if (cardP !== lastP) {
          chapters[k].style.setProperty('--cardP', cardP.toFixed(3))
          lastP = cardP
        }
      } else if (shown >= 0) {
        hideChapter(shown)
        shown = -1
      }

      const final = Math.round(pos) >= 2 * N
      const txt = final ? 'resume scroll ↓' : 'scroll down'
      if (label.textContent !== txt) label.textContent = txt
    }

    // ---- stage lifecycle --------------------------------------------------------
    const release = () => {
      if (released) return
      released = true
      chapters.forEach((_, i) => hideChapter(i))
      cancelAnimationFrame(raf)
      delete root.dataset.stage
      fleetBus.resetStage()
      host.style.display = 'none'
      // every card has been seen — hand the page back at the footer
      window.scrollTo(0, document.documentElement.scrollHeight - window.innerHeight)
    }

    const disable = (silent = false) => {
      if (!enabled) return
      enabled = false
      if (released) return
      if (silent) {
        // teardown/route change: restore without jump-scrolling
        chapters.forEach((_, i) => hideChapter(i))
        cancelAnimationFrame(raf)
        delete root.dataset.stage
        fleetBus.resetStage()
        host.style.display = ''
        return
      }
      release()
    }

    const enable = () => {
      if (enabled || released || dead) return
      chapters = Array.from(document.querySelectorAll<HTMLElement>('.chapter'))
      if (chapters.length < 2) return
      N = chapters.length
      enabled = true
      root.dataset.stage = 'on'
      fleetBus.virtual = true
      fleetBus.formedTarget = 1
      fleetBus.y = 0
      fleetBus.lastInput = performance.now()
      raw = 0
      target = 0
      springing = false
      settleRelease = false
      shown = -1
      lastP = -1
      lastPos = 0
      propAngle = 0
      propVel = 0
      propDirty = true
      window.scrollTo(0, 0)
      measure()
      host.style.display = ''
      label.textContent = 'scroll down'
      lastT = performance.now()
      raf = requestAnimationFrame(frame)
    }

    // ---- gestures ----------------------------------------------------------------
    const onTouchStart = (e: TouchEvent) => {
      if (released || !enabled) return
      fleetBus.lastInput = performance.now()
      // grabbing the propeller spins it by hand — never scrubs the deck
      if ((e.target as Element | null)?.closest?.('.deck-prop')) {
        propDrag = true
        tracking = false
        const r = prop.getBoundingClientRect()
        propCx = r.left + r.width / 2
        propCy = r.top + r.height / 2
        const a = Math.atan2(e.touches[0].clientY - propCy, e.touches[0].clientX - propCx)
        prevA = a
        propCont = 0
        propBase = propAngle
        propVel = 0
        lastPropT = performance.now()
        return
      }
      tracking = true
      springing = false
      lastWheel = 0
      startY = e.touches[0].clientY
      lastY = startY
      startRaw = raw
      vSamples = []
      nestPanel = null
      const el = e.target as Element | null
      const panel = el?.closest?.('.chapter-panel') as HTMLElement | null
      // the panel only takes over when the drawer is (almost) fully open —
      // mid-reveal drags belong to the scrub
      const cardPOK =
        shown >= 0 &&
        parseFloat(chapters[shown].style.getPropertyValue('--cardP') || '0') > 0.9
      if (panel && panel.scrollHeight > panel.clientHeight + 4 && cardPOK) nestPanel = panel
    }

    const onTouchMove = (e: TouchEvent) => {
      if (released || !enabled) return
      if (propDrag) {
        e.preventDefault()
        const t = e.touches[0]
        const a = Math.atan2(t.clientY - propCy, t.clientX - propCx)
        let da = a - prevA
        if (da > Math.PI) da -= Math.PI * 2
        else if (da < -Math.PI) da += Math.PI * 2
        prevA += da
        propCont += da
        propAngle = propBase + (propCont * 180) / Math.PI
        const now = performance.now()
        const dt = (now - lastPropT) / 1000
        if (dt > 0.008) {
          const inst = (da / dt) * (180 / Math.PI)
          propVel = propVel * 0.55 + inst * 0.45
          lastPropT = now
        }
        propDirty = true
        fleetBus.lastInput = now
        return
      }
      if (!tracking) {
        e.preventDefault() // a stray second finger never scrolls the page
        return
      }
      fleetBus.lastInput = performance.now()
      const y = e.touches[0].clientY
      const d = lastY - y // positive = swiping up = "scroll down"
      lastY = y
      if (nestPanel) {
        const p = nestPanel
        const canDown = p.scrollTop + p.clientHeight < p.scrollHeight - 2
        const canUp = p.scrollTop > 2
        if ((d > 0 && canDown) || (d < 0 && canUp)) return // the panel consumes it
        nestPanel = null // panel at its edge — the stage takes over
      }
      e.preventDefault()
      raw = startRaw + (startY - y) / TOUCH_PX_PER_BEAT
      vSamples.push({ t: performance.now(), p: raw })
      if (vSamples.length > 10) vSamples.shift()
    }

    const onTouchEnd = () => {
      if (propDrag) {
        propDrag = false // inertia decays in the frame loop
        return
      }
      if (!tracking) return
      tracking = false
      nestPanel = null
      if (released || !enabled) return
      // fling: fold release velocity into the snap target, then spring
      springTo(Math.round(raw + velocity() * FLING_LEAD), raw > 2 * N)
    }

    const onWheel = (e: WheelEvent) => {
      if (released || !enabled || propDrag || tracking) return
      e.preventDefault()
      fleetBus.lastInput = performance.now()
      springing = false
      const dy =
        e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * window.innerHeight : e.deltaY
      raw += dy / WHEEL_PX_PER_BEAT
      lastWheel = performance.now()
    }

    const onKey = (e: KeyboardEvent) => {
      if (released || !enabled) return
      const down = e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' '
      const up = e.key === 'ArrowUp' || e.key === 'PageUp'
      if (!down && !up) return
      e.preventDefault()
      if (down && Math.round(raw) >= 2 * N) {
        release() // final portrait: the next step hands back the page
        return
      }
      springTo(Math.round(raw) + (down ? 1 : -1))
    }

    const onResize = () => {
      if (!enabled || released) return
      measure()
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
    window.addEventListener('resize', onResize)

    return () => {
      dead = true
      mq.removeEventListener?.('change', onMq)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('touchcancel', onTouchEnd)
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
      disable(true)
    }
  }, [])

  return (
    <div ref={hostRef} className="deck-affordance" aria-hidden="true">
      <span ref={propRef} className="deck-prop">
        <svg ref={svgRef} viewBox="0 0 40 40" width="30" height="30">
          <g fill="var(--red)">
            <ellipse cx="20" cy="10.5" rx="4.4" ry="9" />
            <ellipse cx="20" cy="10.5" rx="4.4" ry="9" transform="rotate(120 20 20)" />
            <ellipse cx="20" cy="10.5" rx="4.4" ry="9" transform="rotate(240 20 20)" />
          </g>
          <circle cx="20" cy="20" r="3.1" fill="var(--fg)" />
        </svg>
      </span>
      <span ref={labelRef} className="deck-affordance-label">
        scroll down
      </span>
    </div>
  )
}
