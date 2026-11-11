'use client'

import { useEffect, useRef } from 'react'
import { fleetBus } from '@/lib/fleetBus'

/**
 * The flight layer — a retro rocket that replaces the old paint snake.
 *
 * The ship lives behind the paper column (z-0), visible in the blueprint
 * gutters and full-bleed bands, always passing BEHIND text so content is
 * never obscured. On narrow screens the sheet opens a dedicated 44px flight
 * gutter (globals.css) and the route hugs it, so the rocket stays visible
 * down the whole page. Everything is scrubbed by scroll progress, so every
 * animation is exactly reversible:
 *
 *   p = 0        parked vertically on its launch pad (top-left margin)
 *   0 → ~0.17    takeoff: rises off the pad with a rough ignition sputter,
 *                pitches over through the hero's upper whitespace, joins
 *                the gutter sine
 *   ~0.17 → 1    full-blast cruise down the page. The nose flies the route:
 *                scrolling down points it down the page, scrolling up turns
 *                it around and it flies back nose-up — with throttle tied
 *                to scroll speed and a dotted fume trail laid along the
 *                traversed arc (the flight path, drawn in reverse as you
 *                scroll back)
 *   1            landing: throttle cuts, the ship pitches upright for a
 *                tail-first touchdown, then decouples — nose, fins and
 *                engine ease apart and dock around the body above the footer
 *   scroll up    the sequence runs backwards: parts reassemble, engine
 *                re-lights with a sputter, and the ship meanders back onto
 *                its pad, sucking up its contrail behind it
 *
 * On phones the ship also strafes the fleet: while it flies near the hero
 * during a dispersal or reform it fires "space balls" ahead of its nose;
 * every ball that connects bursts and shoves the mini ships aside (the
 * fleet reads impacts from lib/fleetBus). The ship and its pad scale down
 * on narrow screens so the flight line never crowds the first screen.
 *
 * Sway, flicker and exhaust emission are gated by smoothed scroll velocity,
 * so a resting page is a still page (the trail and docked state persist).
 *
 * Fallbacks: reduced motion / no 2D canvas -> data-flight="off", which
 * shows a static parked-rocket SVG in the hero (globals.css).
 */

const PAL = {
  light: {
    red: '#fc3d21',
    cream: '#f5efe1',
    ink: '#201d17',
    blue: '#0b3d91',
    flame: '#fc3d21',
    flameCore: '#fff3d6',
  },
  dark: {
    red: '#fc3d21',
    cream: '#ede7d8',
    ink: '#ede7d8',
    blue: '#8fb2f2',
    flame: '#fc3d21',
    flameCore: '#fff3d6',
  },
}

type Pt = { x: number; y: number }

function smoothstep(a: number, b: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

function easeOutBack(t: number) {
  const c = 1.35
  const u = t - 1
  return 1 + (c + 1) * u * u * u + c * u * u
}

export default function FlightCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const root = document.documentElement

    const bail = () => {
      root.dataset.flight = 'off'
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      bail()
      return
    }
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) {
      bail()
      return
    }

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
    let finTip = 31 // fin sweep — folded on narrow so the ship fits its gutter
    let finBase = 15

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
      finTip = narrow ? 22 : 31
      finBase = narrow ? 13 : 15
      const docH = Math.max(
        document.documentElement.scrollHeight,
        document.body?.scrollHeight ?? 0,
        h
      )
      const heroEl = document.querySelector('.hero') as HTMLElement | null
      const footEl = document.querySelector('footer') as HTMLElement | null
      const heroTop = heroEl ? heroEl.getBoundingClientRect().top + window.scrollY : 0
      const heroH = heroEl ? heroEl.offsetHeight : 0
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

      const endY = Math.min(docH - 8, Math.max(footTop - 170, startY + 60))
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

    // ---- rocket parts ----------------------------------------------------------
    // dock offsets in ship-local units (nose up = -y), staggered sub-windows
    type Part = {
      key: 'nose' | 'finL' | 'finR' | 'engine' | 'body'
      dx: number; dy: number; rot: number
      f0: number; f1: number
    }
    const PARTS: Part[] = [
      { key: 'nose', dx: 0, dy: -46, rot: -0.17, f0: 0.0, f1: 0.55 },
      { key: 'finL', dx: -26, dy: 16, rot: -0.35, f0: 0.15, f1: 0.75 },
      { key: 'finR', dx: 26, dy: 16, rot: 0.35, f0: 0.15, f1: 0.75 },
      { key: 'engine', dx: 0, dy: 42, rot: 0, f0: 0.35, f1: 1.0 },
      { key: 'body', dx: 0, dy: 0, rot: 0, f0: 0, f1: 0.01 },
    ]

    const drawPart = (
      g: CanvasRenderingContext2D,
      key: Part['key'],
      pal: (typeof PAL)['light'],
      outline: string
    ) => {
      g.lineWidth = 1.75
      g.strokeStyle = outline
      g.lineJoin = 'round'
      if (key === 'nose') {
        g.beginPath()
        g.moveTo(0, -64)
        g.quadraticCurveTo(13, -56, 16.5, -38)
        g.lineTo(17, -26)
        g.lineTo(-17, -26)
        g.lineTo(-16.5, -38)
        g.quadraticCurveTo(-13, -56, 0, -64)
        g.closePath()
        g.fillStyle = pal.red
        g.fill()
        g.stroke()
      } else if (key === 'finL' || key === 'finR') {
        const s = key === 'finL' ? -1 : 1
        g.beginPath()
        g.moveTo(finBase * s, 6)
        g.lineTo(finTip * s, 44)
        g.lineTo(finBase * s, 40)
        g.closePath()
        g.fillStyle = pal.red
        g.fill()
        g.stroke()
      } else if (key === 'engine') {
        g.beginPath()
        g.moveTo(-11, 34)
        g.lineTo(11, 34)
        g.lineTo(15, 50)
        g.lineTo(-15, 50)
        g.closePath()
        g.fillStyle = pal.ink
        g.fill()
        g.stroke()
      } else {
        // body: cream hull + red band + porthole
        g.beginPath()
        g.moveTo(-17, -26)
        g.lineTo(17, -26)
        g.lineTo(17, 30)
        g.quadraticCurveTo(17, 34, 13, 34)
        g.lineTo(-13, 34)
        g.quadraticCurveTo(-17, 34, -17, 30)
        g.closePath()
        g.fillStyle = pal.cream
        g.fill()
        g.stroke()
        g.save()
        g.beginPath()
        g.moveTo(-17, -26)
        g.lineTo(17, -26)
        g.lineTo(17, 30)
        g.quadraticCurveTo(17, 34, 13, 34)
        g.lineTo(-13, 34)
        g.quadraticCurveTo(-17, 34, -17, 30)
        g.closePath()
        g.clip()
        g.fillStyle = pal.red
        g.fillRect(-17, -26, 34, 14)
        g.restore()
        g.beginPath()
        g.moveTo(-17, -26)
        g.lineTo(17, -26)
        g.lineTo(17, 30)
        g.quadraticCurveTo(17, 34, 13, 34)
        g.lineTo(-13, 34)
        g.quadraticCurveTo(-17, 34, -17, 30)
        g.closePath()
        g.stroke()
        // porthole
        g.beginPath()
        g.arc(0, 2, 6.5, 0, Math.PI * 2)
        g.fillStyle = pal.blue
        g.fill()
        g.lineWidth = 2
        g.stroke()
        g.beginPath()
        g.arc(-2, 0, 1.6, 0, Math.PI * 2)
        g.fillStyle = pal.cream
        g.fill()
      }
    }

    const drawShip = (
      x: number,
      y: number,
      rot: number,
      dockF: number,
      thrust: number,
      flick: number,
      pal: (typeof PAL)['light'],
      outline: string
    ) => {
      const g = ctx
      // flame first (behind everything), rides the engine part
      if (thrust > 0.01) {
        const eng = PARTS[3]
        const f = easeOutBack(Math.max(0, Math.min(1, (dockF - eng.f0) / (eng.f1 - eng.f0))))
        const ex = eng.dx * f
        const ey = eng.dy * f
        const len = (18 + 54 * thrust) * (0.8 + 0.4 * flick)
        const wOut = 5.5 + 3.5 * thrust
        g.save()
        g.translate(x, y)
        g.rotate(rot)
        g.scale(scaleS, scaleS)
        g.translate(ex, ey)
        // outer plume
        g.beginPath()
        g.moveTo(-wOut, 50)
        g.quadraticCurveTo(-wOut * 1.2, 50 + len * 0.55, 0, 50 + len)
        g.quadraticCurveTo(wOut * 1.2, 50 + len * 0.55, wOut, 50)
        g.closePath()
        g.fillStyle = pal.flame
        g.globalAlpha = 0.85
        g.fill()
        // inner core
        g.beginPath()
        g.moveTo(-wOut * 0.53, 50)
        g.quadraticCurveTo(-wOut * 0.66, 50 + len * 0.4, 0, 50 + len * 0.6)
        g.quadraticCurveTo(wOut * 0.66, 50 + len * 0.4, wOut * 0.53, 50)
        g.closePath()
        g.fillStyle = pal.flameCore
        g.globalAlpha = 0.95
        g.fill()
        g.globalAlpha = 1
        g.restore()
      }
      for (const part of PARTS) {
        const f = easeOutBack(Math.max(0, Math.min(1, (dockF - part.f0) / (part.f1 - part.f0))))
        const px = part.dx * f
        const py = part.dy * f
        const pr = part.rot * f
        g.save()
        g.translate(x, y)
        g.rotate(rot + pr)
        g.scale(scaleS, scaleS)
        g.translate(px, py)
        drawPart(g, part.key, pal, outline)
        g.restore()
      }
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

    // ---- theme -----------------------------------------------------------------
    let dark = document.documentElement.classList.contains('dark')
    const themeObserver = new MutationObserver(() => {
      dark = document.documentElement.classList.contains('dark')
    })
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

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
      // reads the stage's virtual Y instead, so the rocket keeps flying as
      // the user steps through the portrait ⇄ card cycle
      const scrollY = fleetBus.virtual ? fleetBus.y : window.scrollY

      // flight progress: purely scroll-driven, eased, fully reversible
      const scrollFrac = docH > vh ? scrollY / (docH - vh) : 0
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

      ctx.clearRect(0, 0, vw, vh)
      if (totalLen <= 1) return

      // the path is document space; this canvas is the viewport — ride the scroll
      const sy = scrollY

      // pad + dock platforms (world space), scaled down with the ship on phones
      const padF = 1 - smoothstep(0.012, 0.05, p)
      const padHalf = Math.round(46 * (narrow ? scaleS * 1.3 : 1))
      const padBeacon = Math.round(52 * (narrow ? scaleS * 1.3 : 1))
      drawPad(path[0].x, path[0].y - sy + 58 * scaleS + 6, padF, pal, padHalf, padBeacon)
      const dockF = smoothstep(0.955, 1.0, p)
      // landing pad meets the detached engine: engine bottom sits at +92·s
      if (dockF > 0.01)
        drawPad(
          dock.x,
          dock.y - sy + 92 * scaleS + 6,
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

      drawShip(shipX, shipY - sy, rot, dockF, flame, flick, pal, outline)

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

      // ignition flash at the bell
      if (flashT > 0) {
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
