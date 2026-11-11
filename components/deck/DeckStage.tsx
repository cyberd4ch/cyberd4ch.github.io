'use client'

import { useEffect, useRef } from 'react'
import { fleetBus } from '@/lib/fleetBus'

/**
 * The presentation stage — phones only (styled via html[data-stage] in
 * globals.css). Takes the home page's mobile flow over from the sticky card
 * deck: the document itself never scrolls (html/body locked, touchmove
 * prevented), and every gesture cycles a fixed two-state stage:
 *
 *   portrait — the fleet's fullscreen ASCII face, alive with idle gestures
 *   card i   — chapter i's rich card slides in while the fleet exits on an
 *              off-screen ring; a propeller + "scroll down" rides below the
 *              panel and spins faster while the user is touching
 *
 * A downward swipe dismisses the card, the portrait immediately re-forms in
 * place, and the next swipe brings the next card — until every card has been
 * seen, when the final swipe unlocks the page and hands back native
 * scrolling (at the footer). Upward swipes step back through the same beats.
 * Swipes that start inside a scrollable card panel scroll the panel instead.
 *
 * The rocket keeps flying: DeckStage tweens fleetBus.y (a virtual scroll
 * position) through the beats, and both canvases read it instead of
 * window.scrollY while the stage is on. Beats map linearly onto the flight:
 * portrait ⇄ card k⇄portrait … so the rocket docks as the last card lands.
 */

// full cycle: P → C0 → P → C1 … → C8 → P-final, then release
const TOUCH_STEP = 64 // px of accumulated swipe that fires a step
const WHEEL_STEP = 90 // px of accumulated wheel that fires a step (QA/desktop)

export default function DeckStage() {
  const hostRef = useRef<HTMLDivElement>(null)
  const labelRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const root = document.documentElement
    const host = hostRef.current
    const label = labelRef.current
    if (!host || !label) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const mq = window.matchMedia('(max-width: 767.98px)')
    let enabled = false
    let released = false
    let dead = false
    let beat = 0 // even = portrait, odd = card (beat-1)/2; monotonic per step
    let busy = false
    let shown = -1 // chapter index currently on screen, -1 = portrait
    let spanPx = 1
    let rafY = 0
    let lastT = 0
    let acc = 0 // touch accumulator (capped while busy)
    let accW = 0 // wheel accumulator
    let tracking = false
    let nestPanel: HTMLElement | null = null
    let fastTimer = 0
    let chapters: HTMLElement[] = []

    const measure = () => {
      // the stage's chapters are fixed (out of flow), so the document
      // height is stable while enabled — hero + footer only
      spanPx = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
    }

    // ---- beat rendering ------------------------------------------------------
    const setLabel = () => {
      const final = beat >= 2 * chapters.length
      const txt = final ? 'resume scroll ↓' : 'scroll down'
      if (label.textContent !== txt) label.textContent = txt
    }

    const showCard = (i: number) => {
      const ch = chapters[i]
      const panel = ch?.querySelector<HTMLElement>('.chapter-panel')
      if (!ch || !panel) return
      chapters.forEach(c => {
        if (c !== ch) c.classList.remove('chapter-on')
      })
      ch.classList.add('chapter-on')
      panel.classList.remove('card-out')
      shown = i
      fleetBus.formedTarget = 0
      // entrance runs via CSS animation; stepping unlocks when it lands
      panel.classList.remove('card-in')
      void panel.offsetWidth // restart the animation from the top
      panel.classList.add('card-in')
      window.setTimeout(() => panel.classList.remove('card-in'), 760)
      window.setTimeout(() => {
        busy = false
      }, 650)
    }

    const hideCard = () => {
      const ch = shown >= 0 ? chapters[shown] : null
      const panel = ch?.querySelector<HTMLElement>('.chapter-panel') ?? null
      shown = -1
      fleetBus.formedTarget = 1
      if (ch && panel) {
        panel.classList.remove('card-in')
        panel.classList.add('card-out')
        window.setTimeout(() => {
          if (!dead && shown === -1) {
            panel.classList.remove('card-out')
            ch.classList.remove('chapter-on')
          }
        }, 330)
      }
      window.setTimeout(() => {
        busy = false
      }, 340)
    }

    const applyBeat = () => {
      const wantCard = beat % 2 === 1
      const idx = wantCard ? (beat - 1) / 2 : -1
      if (wantCard) {
        if (idx !== shown) showCard(Math.min(idx, chapters.length - 1))
        else busy = false
      } else {
        if (shown !== -1) hideCard()
        else busy = false
      }
      setLabel()
    }

    const release = () => {
      if (released) return
      released = true
      chapters.forEach(ch => {
        ch.classList.remove('chapter-on')
        ch.querySelector('.chapter-panel')?.classList.remove('card-in', 'card-out')
      })
      cancelAnimationFrame(rafY)
      delete root.dataset.stage
      delete root.dataset.spin
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
        chapters.forEach(ch => {
          ch.classList.remove('chapter-on')
          ch.querySelector('.chapter-panel')?.classList.remove('card-in', 'card-out')
        })
        cancelAnimationFrame(rafY)
        delete root.dataset.stage
        delete root.dataset.spin
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
      enabled = true
      root.dataset.stage = 'on'
      fleetBus.virtual = true
      fleetBus.formedTarget = 1
      fleetBus.y = 0
      fleetBus.lastInput = performance.now()
      beat = 0
      shown = -1
      busy = false
      window.scrollTo(0, 0)
      measure()
      host.style.display = ''
      setLabel()
      lastT = performance.now()
      const tickY = (now: number) => {
        if (dead || released) return
        rafY = requestAnimationFrame(tickY)
        const dt = Math.min(0.05, lastT ? (now - lastT) / 1000 : 0.016)
        lastT = now
        // beats map linearly onto the (collapsed) document: the rocket flies
        // the route as the deck steps, docked when the final card dismisses
        const target = (beat / (2 * chapters.length)) * spanPx
        const y = fleetBus.y + (target - fleetBus.y) * Math.min(1, dt * 2.6)
        fleetBus.y = Math.abs(target - y) < 0.05 ? target : y
      }
      rafY = requestAnimationFrame(tickY)
    }

    // ---- steps ----------------------------------------------------------------
    const step = (dir: 1 | -1) => {
      if (busy || released || !enabled) return
      fleetBus.lastInput = performance.now()
      if (dir > 0) {
        if (beat >= 2 * chapters.length) {
          release() // final portrait: the next swipe hands back the page
          return
        }
        beat++
      } else {
        if (beat <= 0) return
        beat--
      }
      busy = true
      applyBeat()
    }

    // ---- gestures ---------------------------------------------------------------
    const spinFast = () => {
      if (!root.dataset.spin) root.dataset.spin = 'fast'
    }
    const onTouchStart = (e: TouchEvent) => {
      if (released || !enabled) return
      spinFast()
      fleetBus.lastInput = performance.now()
      tracking = true
      acc = 0
      lastTouchY = e.touches[0].clientY
      nestPanel = null
      const el = e.target as Element | null
      const panel = el?.closest?.('.chapter-panel') as HTMLElement | null
      if (panel && panel.scrollHeight > panel.clientHeight + 4) nestPanel = panel
    }
    const onTouchMove = (e: TouchEvent) => {
      if (released || !enabled) return
      spinFast()
      fleetBus.lastInput = performance.now()
      if (!tracking) {
        e.preventDefault() // a stray second finger never scrolls the page
        return
      }
      const y = e.touches[0].clientY
      const d = lastTouchY - y // positive = swiping up = "scroll down"
      lastTouchY = y
      if (nestPanel) {
        const p = nestPanel
        const canDown = p.scrollTop + p.clientHeight < p.scrollHeight - 2
        const canUp = p.scrollTop > 2
        if ((d > 0 && canDown) || (d < 0 && canUp)) return // the panel consumes it
        nestPanel = null // panel at its edge — the stage takes over
      }
      e.preventDefault()
      acc = Math.max(-240, Math.min(240, acc + d))
      if (Math.abs(acc) >= TOUCH_STEP && !busy) {
        const dir: 1 | -1 = acc > 0 ? 1 : -1
        acc = 0
        step(dir)
      }
    }
    let lastTouchY = 0
    const onTouchEnd = () => {
      tracking = false
      nestPanel = null
      acc = 0
      delete root.dataset.spin
    }
    const onWheel = (e: WheelEvent) => {
      if (released || !enabled) return
      e.preventDefault()
      spinFast()
      fleetBus.lastInput = performance.now()
      window.clearTimeout(fastTimer)
      fastTimer = window.setTimeout(() => {
        if (!tracking) delete root.dataset.spin
      }, 280)
      if (busy) {
        accW = Math.max(-240, Math.min(240, accW + e.deltaY))
        return
      }
      accW += e.deltaY
      if (Math.abs(accW) >= WHEEL_STEP) {
        const dir: 1 | -1 = accW > 0 ? 1 : -1
        accW = 0
        step(dir)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (released || !enabled) return
      const down = e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' '
      const up = e.key === 'ArrowUp' || e.key === 'PageUp'
      if (!down && !up) return
      e.preventDefault()
      step(down ? 1 : -1)
    }
    const onResize = () => {
      if (!enabled || released) return
      measure()
      if (shown >= 0) {
        // keep the affordance/panel relationship honest after rotation etc.
        const ch = chapters[shown]
        if (ch && !ch.classList.contains('chapter-on')) ch.classList.add('chapter-on')
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
      window.clearTimeout(fastTimer)
      disable(true)
    }
  }, [])

  return (
    <div ref={hostRef} className="deck-affordance" aria-hidden="true">
      <span className="deck-prop">
        <svg viewBox="0 0 40 40" width="30" height="30">
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
