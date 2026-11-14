'use client'

import { useEffect, useRef } from 'react'
import { fleetBus } from '@/lib/fleetBus'

/**
 * The flight layer — themed vintage aircraft that replace the old paint
 * snake. The vehicle is picked by the theme MODE (lib/theme.ts data-theme):
 *
 *   system → vintage chopper   (idling rotor, skids)
 *   light  → vintage Cessna    (taildragger, front propeller)
 *   dark   → soviet capsule rocket
 *
 * The ship lives behind the paper column (z-0), visible in the gutters and
 * full-bleed bands, always passing BEHIND text so content is never obscured.
 * On narrow screens the sheet opens a dedicated 44px flight gutter
 * (globals.css) and the route hugs it, so the ship stays visible down the
 * whole page. Everything is scrubbed by scroll progress, so every animation
 * is exactly reversible:
 *
 *   p = 0        parked on its pad (top-left margin)
 *   0 → ~0.17    takeoff: lifts off with a sputter (rotor spooling, prop
 *                winding, or ignition), pitches over through the hero's
 *                upper whitespace, joins the gutter sine
 *   ~0.17 → 1    cruise down the page. The nose flies the route: scrolling
 *                down points it down the page, scrolling up turns it around
 *                and it flies back — with throttle tied to scroll speed and
 *                a dotted fume trail laid along the traversed arc (the
 *                flight path, drawn in reverse as you scroll back)
 *   ~0.95 → 1    landing: throttle cuts, the ship pitches upright and
 *                settles tail-first onto the dock pad in the bottom-right
 *                margin (wheels/skids/nozzle first)
 *   scroll up    the sequence runs backwards: the ship meanders back onto
 *                its pad, sucking up its contrail behind it
 *
 * On phones the ship also strafes the fleet: while it flies near the hero
 * during a dispersal or reform it fires ahead of its nose; every ball that
 * connects bursts and shoves the mini ships aside (the fleet reads impacts
 * from lib/fleetBus). The ship and its pad scale down on narrow screens so
 * the flight line never crowds the first screen.
 *
 * Sway, flicker and exhaust emission are gated by smoothed scroll velocity,
 * so a resting page is a still page (the trail and docked state persist;
 * the chopper's rotor alone keeps idling — it's a rotor).
 */

const PAL = {
  light: {
    red: '#ea384c',
    cream: '#ebe2d6',
    ink: '#17171a',
    blue: '#2f3e81',
    flame: '#ea384c',
    flameCore: '#fff3d6',
  },
  dark: {
    red: '#ff4d64',
    cream: '#2a2a30',
    ink: '#ebe2d6',
    blue: '#8ea2e8',
    flame: '#ff4d64',
    flameCore: '#ffe9c9',
  },
}

type Pt = { x: number; y: number }

// ---- SELA story layer: mission patches for the void ---------------------------
// The gaps where no card / no copy covers the canvas would read as dead
// space. Each chapter gets a small mission patch — pastel chip fills, ink
// linework, a mono uppercase label — drawn with paths + text only (no new
// assets), in both theme palettes.
type Story = {
  /** 1..9 chapter key; 0 = free vignette (desktop void dressing) */
  k: number
  label: string
  chip: string
  kind:
    | 'bullseye'
    | 'orbit'
    | 'plan'
    | 'stack'
    | 'downlink'
    | 'log'
    | 'dish'
    | 'tower'
    | 'planet'
    | 'moon'
  /** desktop: which gutter the patch lives in (-1 left / +1 right) */
  side: -1 | 1
}
const CHIP = ['#93d3e5', '#ffdd7c', '#ffc5c8', '#b9e4aa', '#fffac3']
const STORIES: Story[] = [
  // the five real story stops (app/page.tsx): each patch dresses the void
  // the card rises out of, echoing that card's own icon and name. The
  // mission brief is the landing overlay — the portrait owns that void, so
  // the patch numbering starts at payload stack.
  { k: 1, label: 'payload stack', chip: CHIP[1], kind: 'stack', side: 1 },
  { k: 2, label: 'recent telemetry', chip: CHIP[2], kind: 'orbit', side: -1 },
  { k: 3, label: 'activity log', chip: CHIP[3], kind: 'log', side: 1 },
  { k: 4, label: 'transmissions', chip: CHIP[4], kind: 'downlink', side: -1 },
  { k: 5, label: 'ground stations', chip: CHIP[0], kind: 'tower', side: 1 },
  // free vignettes — desktop void dressing only
  { k: 0, label: 'planetfall', chip: CHIP[4], kind: 'planet', side: -1 },
  { k: 0, label: 'the long dark', chip: CHIP[0], kind: 'moon', side: 1 },
]

/**
 * Stage parallax: on the presentation stage (lib/fleetBus.virtual) the
 * aircraft flies 2.2× the fleet's virtual travel — one card of scrub moves
 * it 2.2 cards of flight — so the flight path visibly leaves the landing
 * area behind and fakes depth beyond it. The route extends past the real
 * document by the same factor, keeping the dock reachable exactly at the
 * last stop.
 */
const PARALLAX = 2.2

function smoothstep(a: number, b: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

export default function FlightCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const root = document.documentElement

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    let dead = false

    // ---- flight path (document space) ---------------------------------------
    let path: Pt[] = []
    let cum: number[] = [] // cumulative arc length per point
    let totalLen = 1
    let joinFrac = 0.14 // arc fraction where the sweep joins the sine
    let dock = { x: 0, y: 0 } // dock centre, document space
    let padPos: Pt = { x: 0, y: 0 }
    let scaleS = 1
    let swayAmp = 10
    let narrow = false
    // story-layer anchors (measured in buildPath)
    let heroTopDoc = 0
    let heroHDoc = 0
    // chapters on the page (the stage's stop count — the landing overlay is
    // not a stop, it rides nothing)
    let storyN = 9

    // ---- themed aircraft -------------------------------------------------------
    // Three vehicles share one flight plan; the theme MODE picks which one
    // is airborne (lib/theme.ts): system → chopper, light → Cessna, dark →
    // soviet capsule rocket. All are drawn in ship-local units, nose up
    // (−y), ~130 units tall, so the same route/pose/attack code drives all.
    type VehicleKind = 'cessna' | 'chopper' | 'vostok'
    let vehicle: VehicleKind = 'chopper'
    const pickVehicle = (): VehicleKind => {
      const m = document.documentElement.dataset.theme
      return m === 'light' ? 'cessna' : m === 'dark' ? 'vostok' : 'chopper'
    }
    let spin = 0 // prop/rotor angle accumulator (rad)
    let spinV = 0 // current angular speed (rad/s)

    // ---- theme -----------------------------------------------------------------
    let dark = document.documentElement.classList.contains('dark')
    vehicle = pickVehicle()
    const themeObserver = new MutationObserver(() => {
      dark = document.documentElement.classList.contains('dark')
      vehicle = pickVehicle()
    })
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme'],
    })

    // ---- contrail: static fume dots laid along the route (doc space) ---------
    type TrailDot = { x: number; y: number; u: number; nx: number; ny: number; wob: number; rj: number }
    let trail: TrailDot[] = []

    // ---- exhaust: smoke puffs emitted from the engine bell (doc space) ------
    type Puff = { x: number; y: number; vx: number; vy: number; r0: number; life: number; age: number; a0: number }
    let puffs: Puff[] = []
    let emitAcc = 0
    let flashT = 0 // ignition flash countdown

    // ---- projectiles: "space balls" strafing the fleet (viewport space) -----
    // On phones the ship guns for the mini ships whenever it is flying near
    // the hero while the fleet is dispersing or reforming: it fires forward
    // along its nose, each ball bursts on contact and the fleet upheaves
    // away from the impact (ShipCanvas drains the kicks).
    type Ball = { x: number; y: number; vx: number; vy: number; r: number; life: number; age: number; blue: boolean }
    let balls: Ball[] = []
    let fireAcc = 0
    type Ripple = { x: number; y: number; age: number }
    let ripples: Ripple[] = []

    const buildPath = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      narrow = w < 760
      // phones: a smaller ship and pad so the flight line never crowds the
      // first screen (the portrait owns it)
      scaleS = narrow ? (w < 480 ? 0.42 : 0.48) : 1
      swayAmp = narrow ? (w < 480 ? 3 : 6) : 10
      const docH = Math.max(
        document.documentElement.scrollHeight,
        document.body?.scrollHeight ?? 0,
        h
      )
      // presentation stage: the stage's travel length lives on
      // fleetBus.spanPx (N stops × posPx). The route is authored straight
      // against the parallaxed virtual travel so the ship, flying 2.2× the
      // fleet, still ends docked on screen at the last stop — the flight
      // path visibly outgrows the landing area, faking depth beyond it
      const spanPx = Math.max(1, fleetBus.virtual ? fleetBus.spanPx : docH - h)
      const heroEl = document.querySelector('.hero') as HTMLElement | null
      const footEl = document.querySelector('footer') as HTMLElement | null
      const heroTop = heroEl ? heroEl.getBoundingClientRect().top + window.scrollY : 0
      const heroH = heroEl ? heroEl.offsetHeight : 0
      heroTopDoc = heroTop
      heroHDoc = heroH
      storyN =
        document.querySelectorAll('.chapter:not(.chapter-peek)').length || 9
      const footTop = footEl ? footEl.getBoundingClientRect().top + window.scrollY : docH

      const outer = w / 2 - 14
      const inner = narrow ? outer - 22 : 340 + 34
      const cx = w / 2 // path x values are absolute viewport space
      const hasHero = heroH > 220 && heroTop < 200
      const startY = hasHero ? heroTop + (narrow ? 180 : 300) : 140
      const period = narrow ? 1000 : 1500
      const phase = 1.15
      const ampAt = (y: number) =>
        inner + (outer - inner) * (0.3 + 0.62 * (0.5 + 0.5 * Math.sin(y / 253 + 1.05)))
      // narrow: the route lives in the 44px flight gutter (globals.css opens it
      // and widens .page-col's right padding to match, so text never sits there).
      // Centered 25px off the right edge — at fin-folded scale the hull keeps
      // ~2px clear of the text column at w-44 on both narrow tiers.
      const ampN = w < 480 ? 3 : 4
      const gutterX = narrow
        ? (y: number) => cx + (outer - 11) + ampN * Math.sin(y / 253 + 1.05)
        : (y: number) => cx + ampAt(y) * Math.sin(((2 * Math.PI * (y - startY)) / period) + phase)

      const pts: Pt[] = []
      const push = (x: number, y: number) => pts.push({ x, y })

      if (hasHero) {
        // launch pad in the top-left margin, clear of the 680 column; on
        // narrow screens the column is full-width, so park below the
        // telemetry row instead (nose clears it by ~30px)
        padPos = { x: cx - (outer - 30), y: heroTop + (narrow ? 110 : 66) }
        push(padPos.x, padPos.y)
        push(padPos.x, padPos.y - (narrow ? 40 : 74)) // vertical rise off the pad
        push(cx - outer * 0.55, heroTop + 96) // pitch over into the hero sweep
        push(cx - outer * 0.05, heroTop + 190)
        push(cx + outer * 0.45, heroTop + 262)
      } else {
        padPos = { x: cx - (outer - 30), y: 120 }
        push(padPos.x, padPos.y)
        push(padPos.x, padPos.y - 70)
      }
      push(gutterX(startY), startY)
      const joinIdx = pts.length - 1

      const endY = fleetBus.virtual
        ? Math.max(startY + 600, PARALLAX * spanPx + h - 120)
        : Math.min(docH - 8, Math.max(footTop - 170, startY + 60))
      const steps = Math.max(8, Math.round((endY - startY) / 26))
      for (let i = 1; i <= steps; i++) {
        const y = startY + ((endY - startY) * i) / steps
        push(gutterX(y), y)
      }

      // dock approach: steer to the right-gutter dock and descend vertically.
      // docked parts span -110·s..+92·s around the ship centre, so keep the
      // centre above the footer with room for the landing pad
      const last = pts[pts.length - 1]
      const dockX = narrow ? w - 25 : Math.min(Math.max(last.x, cx + inner + 30), cx + outer - 20)
      dock = {
        x: dockX,
        y: Math.max(endY + 40, Math.min(endY + 130, footTop - 12 - 104 * scaleS)),
      }
      push(last.x + (dockX - last.x) * 0.4, endY + 26)
      push(last.x + (dockX - last.x) * 0.78, endY + 52)
      push(dockX, dock.y - 30)
      push(dockX, dock.y)

      path = pts
      // cumulative arc length
      cum = [0]
      for (let i = 1; i < pts.length; i++) {
        cum[i] = cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
      }
      totalLen = cum[cum.length - 1]
      joinFrac = cum[joinIdx] / totalLen

      // contrail: deterministic fume dots along the route (doc space). Drawn
      // only over the traversed arc, so the trail grows with the flight and
      // reverses away as the ship climbs back — the flight path made visible.
      trail = []
      const tStep = narrow ? 11 : 16
      for (let s = totalLen * 0.012; s < totalLen * 0.995; s += tStep) {
        const uq = s / totalLen
        const q = pathPoint(uq)
        const qa = pathPoint(Math.max(0, uq - 0.004))
        const qb = pathPoint(Math.min(1, uq + 0.004))
        const tx = qb.x - qa.x
        const ty = qb.y - qa.y
        const tl = Math.hypot(tx, ty) || 1
        const j = ((Math.round(s * 100) * 7919) % 997) / 997
        trail.push({ x: q.x, y: q.y, u: uq, nx: -ty / tl, ny: tx / tl, wob: (j - 0.5) * 5.5, rj: 0.7 + 0.55 * j })
      }
    }

    const pathPoint = (u: number): Pt => {
      const target = Math.max(0, Math.min(1, u)) * totalLen
      let lo = 0
      let hi = cum.length - 1
      while (lo < hi - 1) {
        const mid = (lo + hi) >> 1
        if (cum[mid] <= target) lo = mid
        else hi = mid
      }
      const seg = Math.max(1e-6, cum[hi] - cum[lo])
      const f = (target - cum[lo]) / seg
      return {
        x: path[lo].x + (path[hi].x - path[lo].x) * f,
        y: path[lo].y + (path[hi].y - path[lo].y) * f,
      }
    }

    // ---- canvas sizing --------------------------------------------------------
    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      // pin the CSS box to innerHeight: `inset:0; height:100%` on a fixed
      // element resolves against the LARGE viewport (iOS 100vh), so an
      // innerHeight-sized bitmap gets stretched vertically — and would
      // breathe as mobile toolbars collapse/expand
      canvas.style.width = window.innerWidth + 'px'
      canvas.style.height = window.innerHeight + 'px'
      canvas.width = Math.round(window.innerWidth * dpr)
      canvas.height = Math.round(window.innerHeight * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    // ---- vehicle drawing ---------------------------------------------------------
    // Flame behind the hull (rocket only), then the hull in local units.
    const drawFlame = (
      g: CanvasRenderingContext2D,
      wOut: number,
      y0: number,
      len: number,
      pal: (typeof PAL)['light']
    ) => {
      g.beginPath()
      g.moveTo(-wOut, y0)
      g.quadraticCurveTo(-wOut * 1.2, y0 + len * 0.55, 0, y0 + len)
      g.quadraticCurveTo(wOut * 1.2, y0 + len * 0.55, wOut, y0)
      g.closePath()
      g.fillStyle = pal.flame
      g.globalAlpha = 0.85
      g.fill()
      g.beginPath()
      g.moveTo(-wOut * 0.53, y0)
      g.quadraticCurveTo(-wOut * 0.66, y0 + len * 0.4, 0, y0 + len * 0.6)
      g.quadraticCurveTo(wOut * 0.66, y0 + len * 0.4, wOut * 0.53, y0)
      g.closePath()
      g.fillStyle = pal.flameCore
      g.globalAlpha = 0.95
      g.fill()
      g.globalAlpha = 1
    }

    // one spinning blade pair through (cx, cy) at `ang` — prop, rotors
    const drawBar = (g: CanvasRenderingContext2D, len: number, w: number, fill: string) => {
      g.fillStyle = fill
      g.beginPath()
      g.moveTo(-len, -w / 2)
      g.lineTo(len, -w / 3)
      g.lineTo(len, w / 3)
      g.lineTo(-len, w / 2)
      g.closePath()
      g.fill()
    }

    const drawVehicle = (
      x: number,
      y: number,
      rot: number,
      thrust: number,
      flick: number,
      spinAng: number,
      pal: (typeof PAL)['light'],
      outline: string
    ) => {
      const g = ctx
      g.save()
      g.translate(x, y)
      g.rotate(rot)
      g.scale(scaleS, scaleS)
      g.lineJoin = 'round'
      g.lineCap = 'round'
      g.lineWidth = 1.75
      g.strokeStyle = outline

      if (vehicle === 'vostok') {
        // ---- soviet capsule rocket: sphere capsule + strapped module + fins
        if (thrust > 0.01) {
          drawFlame(g, 5.5 + 3.5 * thrust, 44, (18 + 54 * thrust) * (0.8 + 0.4 * flick), pal)
        }
        // capsule sphere
        g.beginPath()
        g.arc(0, -10, 23, 0, Math.PI * 2)
        g.fillStyle = pal.cream
        g.fill()
        // navy band (clipped into the sphere) + roundel + hatch
        g.save()
        g.beginPath()
        g.arc(0, -10, 23, 0, Math.PI * 2)
        g.clip()
        g.fillStyle = pal.blue
        g.fillRect(-24, -2, 48, 7)
        g.restore()
        g.beginPath()
        g.arc(0, -10, 23, 0, Math.PI * 2)
        g.stroke()
        g.beginPath()
        g.arc(0, -20, 5, 0, Math.PI * 2)
        g.fillStyle = pal.blue
        g.fill()
        g.stroke()
        g.beginPath()
        g.arc(-9, -13, 3, 0, Math.PI * 2)
        g.fillStyle = pal.red
        g.fill()
        // instrument module + skirt
        g.beginPath()
        g.moveTo(-14, 13)
        g.lineTo(14, 13)
        g.lineTo(10, 34)
        g.lineTo(-10, 34)
        g.closePath()
        g.fillStyle = pal.cream
        g.fill()
        g.stroke()
        // swept fins
        g.beginPath()
        g.moveTo(-10, 20)
        g.lineTo(-21, 46)
        g.lineTo(-10, 34)
        g.closePath()
        g.fillStyle = pal.red
        g.fill()
        g.stroke()
        g.beginPath()
        g.moveTo(10, 20)
        g.lineTo(21, 46)
        g.lineTo(10, 34)
        g.closePath()
        g.fillStyle = pal.red
        g.fill()
        g.stroke()
        // nozzle
        g.beginPath()
        g.moveTo(-6, 34)
        g.lineTo(6, 34)
        g.lineTo(8, 44)
        g.lineTo(-8, 44)
        g.closePath()
        g.fillStyle = pal.ink
        g.fill()
        g.stroke()
      } else if (vehicle === 'cessna') {
        // ---- vintage Cessna taildragger: high wing, front prop, tailwheel
        // fuselage (rounded, nose up)
        g.beginPath()
        g.moveTo(-9, -30)
        g.quadraticCurveTo(-9, -36, -4, -37)
        g.lineTo(4, -37)
        g.quadraticCurveTo(9, -36, 9, -30)
        g.lineTo(9, 24)
        g.quadraticCurveTo(9, 28, 5, 28)
        g.lineTo(-5, 28)
        g.quadraticCurveTo(-9, 28, -9, 24)
        g.closePath()
        g.fillStyle = pal.cream
        g.fill()
        g.stroke()
        // windshield strip (navy)
        g.fillStyle = pal.blue
        g.fillRect(-6.5, -31, 13, 5)
        g.strokeRect(-6.5, -31, 13, 5)
        // high wing across the cabin
        g.beginPath()
        g.rect(-31, -11, 62, 7)
        g.fillStyle = pal.blue
        g.fill()
        g.stroke()
        // wing struts
        g.beginPath()
        g.moveTo(-18, -5)
        g.lineTo(-9, 8)
        g.moveTo(18, -5)
        g.lineTo(9, 8)
        g.stroke()
        // tail fin (rudder red) + tailplane
        g.beginPath()
        g.moveTo(-3, 16)
        g.lineTo(-11, 33)
        g.lineTo(-3, 31)
        g.closePath()
        g.fillStyle = pal.red
        g.fill()
        g.stroke()
        g.beginPath()
        g.rect(-14, 24, 28, 3.5)
        g.fillStyle = pal.blue
        g.fill()
        g.stroke()
        // taildragger gear: mains under the wing + tailwheel
        g.beginPath()
        g.moveTo(-9, 18)
        g.lineTo(-15, 30)
        g.moveTo(9, 18)
        g.lineTo(15, 30)
        g.stroke()
        g.beginPath()
        g.arc(-15, 31, 3.4, 0, Math.PI * 2)
        g.fillStyle = pal.ink
        g.fill()
        g.stroke()
        g.beginPath()
        g.arc(15, 31, 3.4, 0, Math.PI * 2)
        g.fill()
        g.stroke()
        g.beginPath()
        g.arc(-2, 32, 2.1, 0, Math.PI * 2)
        g.fill()
        g.stroke()
        // prop: spinner + two blades + motion blur disc when throttled
        g.beginPath()
        g.arc(0, -39, 2.6, 0, Math.PI * 2)
        g.fillStyle = pal.red
        g.fill()
        g.stroke()
        if (thrust > 0.02) {
          g.globalAlpha = 0.16 + 0.1 * thrust
          g.beginPath()
          g.ellipse(0, -39, 16, 2.6, 0, 0, Math.PI * 2)
          g.fillStyle = outline
          g.fill()
          g.globalAlpha = 1
        }
        g.save()
        g.translate(0, -39)
        g.rotate(spinAng)
        drawBar(g, 15.5, 2.3, outline)
        g.restore()
      } else {
        // ---- vintage chopper: bubble cabin, skids, idling main rotor
        // tail boom first (behind the cabin)
        g.beginPath()
        g.rect(-2.4, 14, 4.8, 34)
        g.fillStyle = pal.blue
        g.fill()
        g.stroke()
        // tail fin + tail rotor
        g.beginPath()
        g.moveTo(2.4, 40)
        g.lineTo(9, 50)
        g.lineTo(2.4, 48)
        g.closePath()
        g.fillStyle = pal.red
        g.fill()
        g.stroke()
        g.beginPath()
        g.arc(6, 46, 2.2, 0, Math.PI * 2)
        g.fillStyle = pal.cream
        g.fill()
        g.stroke()
        g.save()
        g.translate(6, 46)
        g.rotate(spinAng * 2.2)
        drawBar(g, 7, 1.8, outline)
        g.restore()
        // cabin
        g.beginPath()
        g.moveTo(-13, 10)
        g.quadraticCurveTo(-13, -16, 0, -17)
        g.quadraticCurveTo(13, -16, 13, 10)
        g.quadraticCurveTo(13, 15, 8, 15)
        g.lineTo(-8, 15)
        g.quadraticCurveTo(-13, 15, -13, 10)
        g.closePath()
        g.fillStyle = pal.cream
        g.fill()
        g.stroke()
        // windshield (navy bubble)
        g.beginPath()
        g.moveTo(-9, -4)
        g.quadraticCurveTo(-9, -14, 0, -15)
        g.quadraticCurveTo(9, -14, 9, -4)
        g.quadraticCurveTo(0, -1, -9, -4)
        g.closePath()
        g.fillStyle = pal.blue
        g.fill()
        g.stroke()
        // skids + struts
        g.beginPath()
        g.moveTo(-18, 27)
        g.lineTo(18, 27)
        g.moveTo(-14, 32)
        g.lineTo(14, 32)
        g.moveTo(-13, 15)
        g.lineTo(-16, 27)
        g.moveTo(13, 15)
        g.lineTo(16, 27)
        g.moveTo(-7, 15)
        g.lineTo(-8, 27)
        g.moveTo(7, 15)
        g.lineTo(8, 27)
        g.stroke()
        // main rotor: mast + hub + blades + blur disc (always idling)
        g.beginPath()
        g.moveTo(0, -17)
        g.lineTo(0, -26)
        g.stroke()
        g.beginPath()
        g.arc(0, -27, 2.6, 0, Math.PI * 2)
        g.fillStyle = pal.red
        g.fill()
        g.stroke()
        g.globalAlpha = 0.15 + 0.12 * thrust
        g.beginPath()
        g.ellipse(0, -27, 34, 2.8, 0, 0, Math.PI * 2)
        g.fillStyle = outline
        g.fill()
        g.globalAlpha = 1
        g.save()
        g.translate(0, -27)
        g.rotate(spinAng)
        drawBar(g, 34, 2.6, outline)
        g.rotate(Math.PI / 2)
        drawBar(g, 34, 2.2, outline)
        g.restore()
      }
      g.restore()
    }

    const drawPad = (
      x: number,
      y: number,
      alpha: number,
      pal: (typeof PAL)['light'],
      half = 46,
      beacon = 52
    ) => {
      if (alpha <= 0.01) return
      const g = ctx
      g.save()
      g.globalAlpha = alpha
      g.strokeStyle = pal.ink
      g.lineWidth = 2.5
      g.beginPath()
      g.moveTo(x - half, y)
      g.lineTo(x + half, y)
      g.stroke()
      g.lineWidth = 1.5
      for (const sx of [-half * 0.83, -half * 0.28, half * 0.28, half * 0.83]) {
        g.beginPath()
        g.moveTo(x + sx, y)
        g.lineTo(x + sx, y + 7)
        g.stroke()
      }
      g.fillStyle = pal.red
      for (const bx of [-beacon, beacon]) {
        g.beginPath()
        g.arc(x + bx, y - 3, 2.2, 0, Math.PI * 2)
        g.fill()
      }
      g.restore()
    }

    // ---- SELA story layer (mission patches) ------------------------------------
    // One patch per chapter: chip-colored disc art, ink linework, a dotted
    // rule and a mono uppercase label. Everything is paths + text on the
    // live theme palette — reverses with scroll, costs no assets.
    const MONO = '700 9px ui-monospace, SFMono-Regular, Menlo, monospace'
    const KICKER = '700 8px ui-monospace, SFMono-Regular, Menlo, monospace'
    const drawStory = (
      s: Story,
      x: number,
      y: number,
      rot: number,
      sc: number,
      pal: (typeof PAL)['light'],
      outline: string,
      alpha: number
    ) => {
      const g = ctx
      g.save()
      g.translate(x, y)
      g.rotate(rot)
      g.scale(sc, sc)
      g.globalAlpha = alpha
      g.lineJoin = 'round'
      g.lineCap = 'round'
      g.strokeStyle = outline
      g.lineWidth = 1.6
      g.textAlign = 'center'
      // kicker over the patch
      g.font = KICKER
      g.fillStyle = pal.red
      g.globalAlpha = alpha * 0.92
      g.fillText(s.k > 0 ? `NO.${String(s.k).padStart(2, '0')}` : 'SELA ORBITAL', 0, -64)
      g.globalAlpha = alpha

      switch (s.kind) {
        case 'bullseye': {
          // the target: range rings + compass ticks
          g.beginPath()
          g.arc(0, 0, 40, 0, Math.PI * 2)
          g.fillStyle = s.chip
          g.fill()
          g.stroke()
          g.beginPath()
          g.arc(0, 0, 26, 0, Math.PI * 2)
          g.stroke()
          g.beginPath()
          g.arc(0, 0, 12, 0, Math.PI * 2)
          g.fillStyle = pal.blue
          g.fill()
          g.stroke()
          g.beginPath()
          g.arc(0, 0, 4, 0, Math.PI * 2)
          g.fillStyle = pal.red
          g.fill()
          g.beginPath()
          g.moveTo(0, -46)
          g.lineTo(0, -34)
          g.moveTo(0, 34)
          g.lineTo(0, 46)
          g.moveTo(-46, 0)
          g.lineTo(-34, 0)
          g.moveTo(34, 0)
          g.lineTo(46, 0)
          g.stroke()
          break
        }
        case 'orbit': {
          // orbit plot: dashed transfer ellipse + planet + moon
          g.beginPath()
          g.ellipse(0, 0, 44, 17, -0.42, 0, Math.PI * 2)
          g.setLineDash([4, 4])
          g.stroke()
          g.setLineDash([])
          g.beginPath()
          g.arc(40, -18, 9, 0, Math.PI * 2)
          g.fillStyle = s.chip
          g.fill()
          g.stroke()
          g.beginPath()
          g.arc(40, -18, 2.6, 0, Math.PI * 2)
          g.fillStyle = pal.blue
          g.fill()
          g.beginPath()
          g.arc(-24, 14, 3.4, 0, Math.PI * 2)
          g.fillStyle = pal.red
          g.fill()
          break
        }
        case 'plan': {
          // flight plan: dashed route, waypoints, destination fix
          g.setLineDash([5, 5])
          g.beginPath()
          g.moveTo(-46, 24)
          g.quadraticCurveTo(-20, 10, -6, -10)
          g.quadraticCurveTo(10, -30, 40, -24)
          g.stroke()
          g.setLineDash([])
          g.beginPath()
          g.arc(-46, 24, 4, 0, Math.PI * 2)
          g.fillStyle = s.chip
          g.fill()
          g.stroke()
          g.beginPath()
          g.arc(-6, -10, 4, 0, Math.PI * 2)
          g.fill()
          g.stroke()
          g.beginPath()
          g.arc(40, -24, 6, 0, Math.PI * 2)
          g.fillStyle = pal.red
          g.fill()
          g.stroke()
          g.beginPath()
          g.arc(40, -24, 2, 0, Math.PI * 2)
          g.fillStyle = pal.flameCore
          g.fill()
          break
        }
        case 'stack': {
          // payload bay: three crates, the top one open under a crane hook
          g.beginPath()
          g.roundRect(-26, 8, 52, 15, 4)
          g.fillStyle = s.chip
          g.fill()
          g.stroke()
          g.beginPath()
          g.roundRect(-26, -10, 52, 15, 4)
          g.stroke()
          g.beginPath()
          g.roundRect(-26, -28, 52, 15, 4)
          g.fillStyle = pal.blue
          g.fill()
          g.stroke()
          g.beginPath()
          g.moveTo(0, -28)
          g.lineTo(0, -42)
          g.moveTo(-26, -28)
          g.lineTo(-33, -39)
          g.moveTo(26, -28)
          g.lineTo(33, -39)
          g.stroke()
          g.beginPath()
          g.arc(0, -45, 2.6, 0, Math.PI * 2)
          g.fillStyle = pal.red
          g.fill()
          break
        }
        case 'downlink': {
          // downlink: telemetry waveform over a baseline
          g.globalAlpha = alpha * 0.5
          g.beginPath()
          g.moveTo(-44, 20)
          g.lineTo(44, 20)
          g.stroke()
          g.globalAlpha = alpha
          g.beginPath()
          g.moveTo(-44, 14)
          g.lineTo(-32, -12)
          g.lineTo(-20, 6)
          g.lineTo(-8, -22)
          g.lineTo(6, 2)
          g.lineTo(18, -14)
          g.lineTo(32, 8)
          g.lineTo(44, -6)
          g.strokeStyle = pal.blue
          g.lineWidth = 2.2
          g.stroke()
          g.strokeStyle = outline
          g.lineWidth = 1.6
          g.fillStyle = pal.red
          g.beginPath()
          g.arc(-8, -22, 2.6, 0, Math.PI * 2)
          g.fill()
          g.beginPath()
          g.arc(18, -14, 2.2, 0, Math.PI * 2)
          g.fill()
          break
        }
        case 'log': {
          // event log: a ledger of stamped rows
          const w = [40, 30, 44, 22]
          for (let i = 0; i < 4; i++) {
            const ry = -30 + i * 18
            g.beginPath()
            g.roundRect(-40, ry - 5.5, 11, 11, 2.5)
            g.fillStyle = i === 1 ? pal.red : s.chip
            g.fill()
            g.stroke()
            g.beginPath()
            g.moveTo(-22, ry)
            g.lineTo(-22 + w[i], ry)
            g.stroke()
          }
          break
        }
        case 'dish': {
          // deep space net: dish on its mast, signal arcs up
          g.beginPath()
          g.moveTo(-26, 34)
          g.lineTo(26, 34)
          g.moveTo(0, 34)
          g.lineTo(0, 26)
          g.stroke()
          g.beginPath()
          g.arc(0, 6, 20, Math.PI * 0.18, Math.PI * 0.82)
          g.closePath()
          g.fillStyle = s.chip
          g.fill()
          g.stroke()
          g.beginPath()
          g.moveTo(0, 17)
          g.lineTo(0, 8)
          g.stroke()
          g.strokeStyle = pal.red
          for (const r of [8, 14, 20]) {
            g.beginPath()
            g.arc(0, 8, r, -Math.PI * 0.75, -Math.PI * 0.25)
            g.stroke()
          }
          g.strokeStyle = outline
          break
        }
        case 'tower': {
          // tracking station: A-frame mast, radome, broadcast arcs
          g.beginPath()
          g.moveTo(-36, 32)
          g.lineTo(36, 32)
          g.moveTo(-14, 32)
          g.lineTo(0, 2)
          g.moveTo(14, 32)
          g.lineTo(0, 2)
          g.moveTo(-9, 22)
          g.lineTo(9, 22)
          g.stroke()
          g.beginPath()
          g.arc(0, 2, 8, Math.PI, 0)
          g.closePath()
          g.fillStyle = s.chip
          g.fill()
          g.stroke()
          g.strokeStyle = pal.red
          for (const r of [13, 20, 27]) {
            g.beginPath()
            g.arc(0, 2, r, Math.PI * 1.2, Math.PI * 1.8)
            g.stroke()
          }
          g.strokeStyle = outline
          break
        }
        case 'planet': {
          // planetfall: banded planet + dashed ring
          g.beginPath()
          g.arc(0, 0, 26, 0, Math.PI * 2)
          g.fillStyle = s.chip
          g.fill()
          g.save()
          g.beginPath()
          g.arc(0, 0, 26, 0, Math.PI * 2)
          g.clip()
          g.fillStyle = pal.blue
          g.fillRect(-27, -8, 54, 9)
          g.fillStyle = pal.red
          g.beginPath()
          g.arc(-9, -15, 3, 0, Math.PI * 2)
          g.fill()
          g.beginPath()
          g.arc(10, 13, 2.2, 0, Math.PI * 2)
          g.fill()
          g.restore()
          g.beginPath()
          g.arc(0, 0, 26, 0, Math.PI * 2)
          g.stroke()
          g.save()
          g.rotate(-0.5)
          g.beginPath()
          g.ellipse(0, 0, 44, 10, 0, 0, Math.PI * 2)
          g.setLineDash([6, 5])
          g.stroke()
          g.setLineDash([])
          g.restore()
          break
        }
        case 'moon': {
          // the long dark: a night-side disc, lit rim, distant sparks
          g.beginPath()
          g.arc(-4, 0, 24, 0, Math.PI * 2)
          g.fillStyle = dark ? pal.cream : pal.ink
          g.fill()
          g.beginPath()
          g.arc(-4, 0, 24, 0, Math.PI * 2)
          g.strokeStyle = outline
          g.stroke()
          g.beginPath()
          g.arc(-4, 0, 24, -Math.PI * 0.28, Math.PI * 0.34)
          g.strokeStyle = s.chip
          g.lineWidth = 5
          g.stroke()
          g.strokeStyle = outline
          g.lineWidth = 1.6
          g.beginPath()
          g.moveTo(24, -24)
          g.lineTo(24, -16)
          g.moveTo(20, -20)
          g.lineTo(28, -20)
          g.moveTo(34, 10)
          g.lineTo(34, 16)
          g.moveTo(31, 13)
          g.lineTo(37, 13)
          g.stroke()
          g.beginPath()
          g.ellipse(10, 4, 34, 12, 0.5, 0, Math.PI * 2)
          g.setLineDash([3, 5])
          g.stroke()
          g.setLineDash([])
          break
        }
      }

      // dotted rule + mono label under the patch
      g.strokeStyle = outline
      g.globalAlpha = alpha * 0.55
      g.setLineDash([1, 4])
      g.lineWidth = 1.4
      g.beginPath()
      g.moveTo(-34, 58)
      g.lineTo(34, 58)
      g.stroke()
      g.setLineDash([])
      g.globalAlpha = alpha
      g.fillStyle = outline
      g.font = MONO
      g.fillText(s.label.toUpperCase(), 0, 72)
      g.restore()
    }

    const drawStories = (pal: (typeof PAL)['light'], outline: string, sy: number) => {
      const vw = window.innerWidth
      const vh = window.innerHeight
      if (fleetBus.virtual) {
        // stage: each chapter's patch rides the same 2.2× parallax as the
        // aircraft — it rises from below as the deck scrubs toward its card,
        // settles centred in the void above the parked card's bar, and
        // exits upward as the deck moves on. The void is never empty.
        const n = Math.max(1, storyN)
        const span = Math.max(1, fleetBus.spanPx)
        const stagePos = (sy * n) / (span * PARALLAX)
        const pxPerPos = (span * PARALLAX) / n
        for (const s of STORIES) {
          if (s.k === 0) continue // the vignettes dress the desktop void only
          const phase = Math.max(0, 1 - Math.abs(stagePos - s.k) / 0.62)
          if (phase < 0.04) continue
          const y = ((s.k - 0.5) - stagePos) * pxPerPos + vh * 1.02
          const x = vw * (s.k % 2 ? 0.36 : 0.64) + Math.sin(t * 0.4 + s.k * 1.7) * 8
          const rot = (s.k % 2 ? -0.055 : 0.05) + Math.sin(t * 0.32 + s.k) * 0.03
          drawStory(s, x, y, rot, 0.92 + 0.08 * phase, pal, outline, phase)
        }
        return
      }
      // desktop: patches sit in the gutters beside the opaque paper column,
      // plus two free vignettes (planet in the hero's left whitespace, moon
      // above the dock pad)
      const docH = Math.max(document.documentElement.scrollHeight, vh)
      const colL = Math.max(0, (vw - 680) / 2)
      const colR = colL + 680
      const gW = Math.min(colL, vw - colR)
      const heroBottom = heroTopDoc + heroHDoc
      const ySpan = Math.max(vh * 2, docH - heroBottom - vh * 0.9)
      for (const s of STORIES) {
        let docY: number
        let x: number
        let show: boolean
        if (s.k === 0) {
          show = vw >= 820
          docY =
            s.kind === 'planet'
              ? heroTopDoc + heroHDoc * 0.6
              : Math.max(heroBottom, dock.y - vh * 0.52)
          x =
            s.kind === 'planet'
              ? Math.max(84, colL * 0.5)
              : Math.min(vw - 92, colR + (vw - colR) * 0.5)
        } else {
          show = gW >= 92
          docY = heroBottom + ((s.k - 0.5) / Math.max(1, storyN)) * ySpan
          x = s.side < 0 ? Math.max(70, colL * 0.5) : Math.min(vw - 70, colR + (vw - colR) * 0.5)
        }
        if (!show) continue
        const y = docY - sy + Math.sin(t * 0.5 + s.k * 2.1) * 6
        if (y < -150 || y > vh + 150) continue // off-screen cull
        const rot = (s.side < 0 ? -0.05 : 0.045) + Math.sin(t * 0.3 + s.k) * 0.025
        drawStory(s, x, y, rot, s.k === 0 ? 1 : Math.min(1, gW / 150), pal, outline, 1)
      }
    }

    // ---- lifecycle ---------------------------------------------------------------
    let raf = 0
    let running = !document.hidden

    const onVisibility = () => {
      running = !document.hidden
      if (running && !dead) {
        clockLast = 0
        raf = requestAnimationFrame(frame)
      } else {
        cancelAnimationFrame(raf)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    let clockLast = 0
    let t = 0
    let p = 0
    let pPrev = 0
    let dir = 1 // travel direction: +1 down the route (scrolling down), −1 back up
    let rot = 0 // persistent ship attitude (eased, snapped when settled)
    let inited = false
    let prevThrust = 0
    let lastRotAttr = ''
    let lastScrollY = window.scrollY
    let lastVirtual = fleetBus.virtual
    let activity = 0

    const frame = () => {
      raf = requestAnimationFrame(frame)
      if (dead) return
      const now = performance.now()
      const dt = Math.min(0.05, clockLast ? (now - clockLast) / 1000 : 0.016)
      clockLast = now
      t += dt

      const vw = window.innerWidth
      const vh = window.innerHeight
      const docH = Math.max(document.documentElement.scrollHeight, vh)
      // presentation stage: the document never scrolls — the flight layer
      // reads the stage's virtual Y instead (multiplied for parallax), so
      // the aircraft keeps flying as the user steps through cards, faster
      // than the fleet moves. A virtual flip rebuilds the (longer) route.
      const virt = fleetBus.virtual
      if (virt !== lastVirtual) {
        lastVirtual = virt
        size()
        buildPath()
      }
      const scrollY = virt ? fleetBus.y * PARALLAX : window.scrollY

      // flight progress: purely scroll-driven, eased, fully reversible
      const span = Math.max(0, fleetBus.virtual ? fleetBus.spanPx : docH - vh) * (virt ? PARALLAX : 1)
      const scrollFrac = span > 0 ? scrollY / span : 0
      const target = Math.min(1, scrollFrac)
      p += (target - p) * Math.min(1, dt * 3.2)
      if (Math.abs(target - p) < 0.0008) p = target // snap: a resting page is exactly still

      // sway + flicker follow scroll velocity; a resting page is still
      const dy = scrollY - lastScrollY
      lastScrollY = scrollY
      const act = Math.min(1, Math.abs(dy) / Math.max(1, dt) / 1100)
      activity += (act - activity) * Math.min(1, dt * 3.5)

      const pal = PAL[dark ? 'dark' : 'light']
      const outline = dark ? pal.cream : pal.ink

      // a full-screen card covers the art area (deck parked on a stop):
      // skip every stroke — the canvas keeps its last painted frame behind
      // the card, nothing redraws until the deck moves again
      if (fleetBus.covered) {
        pPrev = p
        return
      }

      ctx.clearRect(0, 0, vw, vh)
      if (totalLen <= 1) return

      // the story layer first, so the aircraft and its trail fly in front.
      // The story linework/labels use pal.ink — the palette's contrast color
      // in BOTH themes (#17171a on paper, #ebe2d6 on the dark page). The
      // frame's `outline` (dark ? cream : ink) is the vehicle's fill-blend
      // stroke and would render dark-on-dark up here.
      drawStories(pal, pal.ink, scrollY)

      // the path is document space; this canvas is the viewport — ride the scroll
      const sy = scrollY

      // pad + dock platforms (world space), scaled down with the ship on phones
      const padF = 1 - smoothstep(0.012, 0.05, p)
      const padHalf = Math.round(46 * (narrow ? scaleS * 1.3 : 1))
      const padBeacon = Math.round(52 * (narrow ? scaleS * 1.3 : 1))
      drawPad(path[0].x, path[0].y - sy + 58 * scaleS + 6, padF, pal, padHalf, padBeacon)
      const dockF = smoothstep(0.955, 1.0, p)
      // landing pad meets the landing gear: gear bottom sits at +50·s
      if (dockF > 0.01)
        drawPad(
          dock.x,
          dock.y - sy + 50 * scaleS + 6,
          dockF,
          pal,
          Math.round((narrow ? 20 : 46) * (narrow ? scaleS * 1.3 : 1)),
          Math.round((narrow ? 14 : 52) * (narrow ? scaleS * 1.3 : 1))
        )

      // ship pose
      const u = Math.max(0, Math.min(1, p))
      const pos = pathPoint(u)
      const ahead = pathPoint(Math.min(1, u + 0.012))
      const behind = pathPoint(Math.max(0, u - 0.012))

      // attitude: the ship flies the route. The route is authored pad→dock,
      // so its tangent always points "down the page"; the direction of travel
      // decides which end leads — scrolling down flies it forward (nose down
      // the page), scrolling up turns it around and it flies back nose-up.
      // At both ends of the route it pitches upright: parked on the pad,
      // tail-first into the landing burn.
      const dp = p - pPrev
      if (dp > 1e-6) dir = 1
      else if (dp < -1e-6) dir = -1
      const tangent = Math.atan2(ahead.y - behind.y, ahead.x - behind.x)
      let rotTarget = tangent + Math.PI / 2 + (dir < 0 ? Math.PI : 0)
      const endB = Math.max(1 - smoothstep(0.004, 0.028, u), smoothstep(0.945, 0.985, u))
      if (endB > 0) {
        let d = -rotTarget
        while (d > Math.PI) d -= 2 * Math.PI
        while (d < -Math.PI) d += 2 * Math.PI
        rotTarget += d * endB
      }
      if (!inited) {
        rot = rotTarget
        inited = true
      } else {
        let d2 = rotTarget - rot
        while (d2 > Math.PI) d2 -= 2 * Math.PI
        while (d2 < -Math.PI) d2 += 2 * Math.PI
        rot += d2 * Math.min(1, dt * (5 + 10 * activity))
        if (Math.abs(d2) < 0.0008) rot = rotTarget // snap: a resting page is exactly still
      }
      // QA hook: the live attitude (also proves stillness — it stops updating
      // once the ship settles). rot 0 = nose-up, ±π = nose-down.
      {
        const rotAttr = rot.toFixed(3)
        if (rotAttr !== lastRotAttr) {
          canvas.dataset.rot = rotAttr
          lastRotAttr = rotAttr
        }
      }

      const swayF = smoothstep(0.02, 0.06, p) * (1 - smoothstep(0.945, 0.985, p))
      const a = swayAmp * activity * swayF
      const swx = Math.sin(u * 46 - t * 1.5) * a
      const swy = Math.sin(u * 27 + t * 1.05) * a
      const thrust = smoothstep(0.015, 0.05, p) * (1 - smoothstep(0.95, 0.985, p))
      const flick = 0.5 + 0.5 * Math.sin(t * 21) * activity

      // ignition: a rough sputter while the engine catches, then full blast.
      // The gate opens at a resting page (steady burn) — nothing idles.
      const igniteF = 1 - smoothstep(0.25, 0.75, thrust)
      const gate =
        activity > 0.02 && igniteF > 0.05
          ? Math.sin(t * 33 + Math.sin(t * 11.3) * 2.4) > 0.9 - 1.9 * igniteF
            ? 1
            : 0.12
          : 1
      const flame = thrust * (1 - 0.88 * igniteF * (1 - gate))
      if (prevThrust < 0.02 && thrust >= 0.02) flashT = 0.3
      prevThrust = thrust
      flashT = Math.max(0, flashT - dt)

      // ---- world anchors (ship + engine bell, document space) --------------
      const shipX = pos.x + swx
      const shipY = pos.y + swy
      const engX = shipX - Math.sin(rot) * 50 * scaleS
      const engY = shipY + Math.cos(rot) * 50 * scaleS

      // dotted contrail along the traversed arc: fresh gas bright behind the
      // ship, older puffs bigger and fainter but persistent — the flight path
      // stays readable after the ship has passed, and reverses away as it
      // climbs back
      if (u > 0.014 && trail.length) {
        const span = Math.max(1e-6, u - 0.012)
        ctx.fillStyle = pal.ink
        for (const q of trail) {
          if (q.u > u - 0.006) continue
          const age = Math.min(1, (u - q.u) / span)
          ctx.globalAlpha = (0.06 + 0.3 * (1 - age)) * q.rj
          const r = (1.3 + 4.2 * age) * (narrow ? scaleS * 1.3 : 1) * q.rj
          ctx.beginPath()
          ctx.arc(q.x + q.nx * q.wob, q.y - sy + q.ny * q.wob, r, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.globalAlpha = 1
      }

      // exhaust: smoke puffs from the engine bell. Emission is gated by
      // throttle and scroll activity — a resting page emits nothing and the
      // leftovers disperse within ~2s, leaving only the contrail
      const exX = -Math.sin(rot)
      const exY = Math.cos(rot)
      emitAcc += flame * (narrow ? 26 : 46) * activity * dt
      const cap = narrow ? 90 : 200
      while (emitAcc >= 1) {
        emitAcc -= 1
        if (puffs.length >= cap) break
        const j = Math.random()
        const j2 = Math.random() - 0.5
        const sp = (30 + 90 * flame) * (0.45 + 0.8 * j)
        puffs.push({
          x: engX + exX * (2 + 6 * j) - exY * j2 * 13,
          y: engY + exY * (2 + 6 * j) + exX * j2 * 13,
          vx: exX * sp - exY * j2 * 26 + (Math.random() - 0.5) * 10,
          vy: exY * sp + exX * j2 * 26 - (10 + 14 * Math.random()),
          r0: (1.6 + 2.2 * j) * (narrow ? 0.7 : 1),
          life: 1.2 + 0.9 * j,
          age: 0,
          a0: 0.15 + 0.15 * flame,
        })
      }
      for (let i = puffs.length - 1; i >= 0; i--) {
        const q = puffs[i]
        q.age += dt
        if (q.age >= q.life) {
          puffs.splice(i, 1)
          continue
        }
        const dec = Math.exp(-1.5 * dt)
        q.vx *= dec
        q.vy *= dec
        q.x += q.vx * dt
        q.y += q.vy * dt
      }
      if (puffs.length) {
        ctx.fillStyle = pal.ink
        for (const q of puffs) {
          const f = q.age / q.life
          ctx.globalAlpha = q.a0 * (1 - f) * (0.5 + 0.5 * flame)
          ctx.beginPath()
          ctx.arc(q.x, q.y - sy, q.r0 + 15 * f * (narrow ? 0.6 : 1), 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.globalAlpha = 1
      }

      // prop/rotor speed: the chopper idles forever, the prop winds with
      // throttle, the rocket has none — all eased so throttle changes read
      const spinTarget =
        vehicle === 'chopper'
          ? 2.2 + 11 * flame
          : vehicle === 'cessna'
            ? flame > 0.02
              ? 7 + 42 * flame
              : 0
            : 0
      spinV += (spinTarget - spinV) * Math.min(1, dt * 5)
      spin += spinV * dt

      drawVehicle(shipX, shipY - sy, rot, flame, flick, spin, pal, outline)

      // ---- strafing run -------------------------------------------------------
      // the ship attacks the mini ships whenever it is flying near the hero
      // while the fleet is mid-transition (dispersing or reforming) — the
      // takeoff strafes the scattering fleet and the climb back to the pad
      // fires on the ships rushing home. publishes the pose for ShipCanvas.
      const shipVY = shipY - sy
      const fleetLive = fleetBus.ships.length > 0
      const attacking =
        narrow &&
        fleetLive &&
        fleetBus.formed > 0.03 &&
        fleetBus.formed < 0.97 &&
        activity > 0.05 &&
        p < 0.9 &&
        shipVY < vh * 1.2 &&
        shipVY > -vh * 0.4
      fleetBus.rocket.x = shipX
      fleetBus.rocket.y = shipVY
      fleetBus.rocket.attacking = attacking

      if (attacking) {
        const noseX = shipX + 64 * scaleS * Math.sin(rot)
        const noseY = shipVY - 64 * scaleS * Math.cos(rot)
        fireAcc += dt * (8 + 7 * activity)
        while (fireAcc >= 1) {
          fireAcc -= 1
          if (balls.length >= (vw < 480 ? 14 : 22)) {
            fireAcc = 0
            break
          }
          const sp = 250 + Math.random() * 190
          const spread = (Math.random() - 0.5) * 0.55
          const cs = Math.cos(spread)
          const sn = Math.sin(spread)
          const dx0 = Math.sin(rot)
          const dy0 = -Math.cos(rot)
          balls.push({
            x: noseX,
            y: noseY,
            vx: (dx0 * cs - dy0 * sn) * sp + (Math.random() - 0.5) * 36,
            vy: (dy0 * cs + dx0 * sn) * sp + (Math.random() - 0.5) * 36,
            r: 1.9 + Math.random() * 1.7,
            life: 0.85 + Math.random() * 0.5,
            age: 0,
            blue: Math.random() < 0.35,
          })
        }
      } else {
        fireAcc = 0
      }

      // balls fly, strafe the fleet, burst on contact
      for (let i = balls.length - 1; i >= 0; i--) {
        const b = balls[i]
        b.age += dt
        b.x += b.vx * dt
        b.y += b.vy * dt
        const drag = Math.exp(-0.9 * dt)
        b.vx *= drag
        b.vy *= drag
        let hit = false
        if (b.age < b.life) {
          for (const q of fleetBus.ships) {
            const dx = q.x - b.x
            const dy = q.y - b.y
            const rr = q.s * 0.5 + b.r + 3
            if (dx * dx + dy * dy < rr * rr) {
              hit = true
              break
            }
          }
        }
        if (hit || b.age >= b.life) {
          if (hit) {
            fleetBus.kick(b.x, b.y, 120, 190 + Math.random() * 130)
            if (ripples.length < 12) ripples.push({ x: b.x, y: b.y, age: 0 })
          }
          balls.splice(i, 1)
        }
      }

      // ignition flash at the bell (rocket only)
      if (flashT > 0 && vehicle === 'vostok') {
        const k = flashT / 0.3
        ctx.globalAlpha = 0.5 * k * k
        ctx.fillStyle = pal.flameCore
        ctx.beginPath()
        ctx.arc(engX, engY - sy, (6 + 24 * (1 - k)) * scaleS, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = 1
      }

      // impact rings where balls connected with the fleet
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i]
        rp.age += dt
        if (rp.age > 0.42) {
          ripples.splice(i, 1)
          continue
        }
        const f = rp.age / 0.42
        ctx.strokeStyle = pal.blue
        ctx.globalAlpha = 0.5 * (1 - f)
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(rp.x, rp.y, 4 + f * 30, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.globalAlpha = 1

      // the space balls: halo, core, short trail
      if (balls.length) {
        for (const b of balls) {
          const f = Math.min(1, b.age / b.life)
          const a = f < 0.12 ? f / 0.12 : 1 - Math.max(0, (f - 0.7) / 0.3) * 0.6
          const tint = b.blue ? pal.blue : pal.flame
          ctx.strokeStyle = tint
          ctx.globalAlpha = 0.3 * a
          ctx.lineWidth = Math.max(1, b.r * 0.9)
          ctx.beginPath()
          ctx.moveTo(b.x - b.vx * 0.045, b.y - b.vy * 0.045)
          ctx.lineTo(b.x, b.y)
          ctx.stroke()
          ctx.fillStyle = tint
          ctx.globalAlpha = 0.22 * a
          ctx.beginPath()
          ctx.arc(b.x, b.y, b.r * 2.7, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = pal.flameCore
          ctx.globalAlpha = a
          ctx.beginPath()
          ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.globalAlpha = 1
      }

      pPrev = p
    }

    buildPath()
    size()
    root.dataset.flight = 'on'
    raf = requestAnimationFrame(frame)

    let lastW = window.innerWidth
    let lastDocH = document.documentElement.scrollHeight
    let rebuildTimer = 0
    const scheduleRebuild = () => {
      window.clearTimeout(rebuildTimer)
      rebuildTimer = window.setTimeout(() => {
        if (dead) return
        const w = window.innerWidth
        const docH = document.documentElement.scrollHeight
        if (Math.abs(w - lastW) > 4 || Math.abs(docH - lastDocH) > 200) {
          lastW = w
          lastDocH = docH
          size()
          buildPath()
        }
      }, 180)
    }
    window.addEventListener('resize', scheduleRebuild)
    const bodyObserver = new ResizeObserver(scheduleRebuild)
    bodyObserver.observe(document.body)
    if (document.fonts) document.fonts.ready.then(scheduleRebuild).catch(() => {})

    return () => {
      dead = true
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', scheduleRebuild)
      document.removeEventListener('visibilitychange', onVisibility)
      bodyObserver.disconnect()
      window.clearTimeout(rebuildTimer)
      themeObserver.disconnect()
      delete root.dataset.flight
    }
  }, [])

  return <canvas ref={canvasRef} className="flight-canvas" aria-hidden="true" />
}
