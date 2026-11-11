'use client'

import { useEffect } from 'react'

/**
 * The deck driver — phones only. Marks the document as deck mode
 * (`data-deck="on"`, which the fleet reads to time its dispersal to the
 * cards) and plays the first card's lift-off: scrolling back up from the
 * identity card doesn't slide it down the way sticky reversal would — the
 * card lifts up off the page and fades while the fleet reassembles the
 * portrait behind it. Every chapter below the first is plain sticky
 * choreography and needs no JS.
 */
export default function DeckDriver() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const root = document.documentElement
    const mq = window.matchMedia('(max-width: 767.98px)')
    let raf = 0
    let dead = false
    let card: HTMLElement | null = null
    let hero: HTMLElement | null = null
    let top = 0
    let lastTy = Number.NaN
    let lastOp = Number.NaN
    let lastHop = Number.NaN

    const measure = () => {
      const chapter = document.querySelector<HTMLElement>('[data-chapter-first="true"]')
      card = chapter?.querySelector<HTMLElement>('.chapter-card') ?? null
      top = chapter?.offsetTop ?? 0
      hero = document.querySelector<HTMLElement>('.hero')
    }

    const setHeroOp = (v: number | null) => {
      if (!hero) return
      if (v === null) {
        if (!Number.isNaN(lastHop)) {
          hero.style.opacity = ''
          lastHop = Number.NaN
        }
        return
      }
      if (v !== lastHop) {
        hero.style.opacity = v.toFixed(3)
        lastHop = v
      }
    }

    const frame = () => {
      raf = requestAnimationFrame(frame)
      if (dead) return
      const on = mq.matches && card && top > 0
      if (on && card) {
        if (root.dataset.deck !== 'on') root.dataset.deck = 'on'
        const s = window.scrollY
        if (s < top) {
          // k: 0 at the pin point (card fully shown) → 1 back at the top
          const k = 1 - s / top
          const ty = -(top - s) - 96 * k // cancel the flow offset, then lift
          // fade a shade faster than the lift so the crossfade hands off
          // cleanly to the reforming portrait (no long translucent overlap)
          const op = Math.max(0, 1 - k * 1.3)
          if (ty !== lastTy) {
            card.style.transform = `translate3d(0, ${ty.toFixed(1)}px, 0)`
            card.style.willChange = 'transform, opacity'
            lastTy = ty
          }
          if (op !== lastOp) {
            card.style.opacity = op.toFixed(3)
            // gone is gone: no ghosting over the portrait, no stealing taps
            card.style.visibility = op < 0.08 ? 'hidden' : 'visible'
            lastOp = op
          }
          // the hero's HUD copy yields to the arriving card: fading the hero
          // section (copy + ticker; the fleet canvases live outside it) early
          // in the rise keeps the crossfade text-free — the dispersing fleet
          // carries the transition instead of overlapping text
          setHeroOp(Math.max(0, 1 - (s / top) * 1.8))
        } else if (!Number.isNaN(lastTy)) {
          card.style.transform = ''
          card.style.opacity = ''
          card.style.visibility = ''
          card.style.willChange = ''
          lastTy = Number.NaN
          lastOp = Number.NaN
          setHeroOp(null)
        }
      } else if (root.dataset.deck) {
        delete root.dataset.deck
        if (card) {
          card.style.transform = ''
          card.style.opacity = ''
          card.style.visibility = ''
          card.style.willChange = ''
        }
        lastTy = Number.NaN
        lastOp = Number.NaN
        setHeroOp(null)
      }
    }

    measure()
    raf = requestAnimationFrame(frame)
    const ro = new ResizeObserver(measure)
    ro.observe(document.body)
    window.addEventListener('resize', measure)
    if (document.fonts) document.fonts.ready.then(measure).catch(() => {})

    return () => {
      dead = true
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('resize', measure)
      delete root.dataset.deck
      if (card) {
        card.style.transform = ''
        card.style.opacity = ''
        card.style.visibility = ''
        card.style.willChange = ''
      }
      if (hero) hero.style.opacity = ''
    }
  }, [])

  return null
}
