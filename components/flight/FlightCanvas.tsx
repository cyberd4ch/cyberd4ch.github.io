'use client'

import { useEffect, useRef } from 'react'

/**
 * The flight layer — a retro rocket that replaces the old paint snake.
 *
 * The ship lives behind the paper column (z-0), visible in the blueprint
 * gutters and full-bleed bands, always passing BEHIND text so content is
 * never obscured. Everything is scrubbed by scroll progress, so every
 * animation is exactly reversible:
 *
 *   p = 0        parked vertically on its launch pad (top-left margin)
 *   0 → ~0.17    takeoff: rises off the pad, pitches over through the
 *                hero's upper whitespace, joins the gutter sine
 *   ~0.17 → 1    meanders down the page, nose held up (tail-first descent,
 *                retro-burn) with sway that follows scroll velocity
 *   1            landing: decelerates, decouples — nose, fins and engine
 *                ease apart and dock around the body above the footer
 *   scroll up    the sequence runs backwards: parts reassemble, takeoff,
 *                and the ship meanders back onto its pad
 *
 * Sway and flame flicker are gated by smoothed scroll velocity, so a
 * resting page is a still page.
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

    const buildPath = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      narrow = w < 760
      scaleS = narrow ? (w < 480 ? 0.52 : 0.62) : 1
      swayAmp = narrow ? (w < 480 ? 3 : 6) : 10
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
      const inner = narrow ? outer - 9 : 340 + 34
      const cx = w / 2 // path x values are absolute viewport space
      const hasHero = heroH > 220 && heroTop < 200
      const startY = hasHero ? heroTop + (narrow ? 180 : 300) : 140
      const period = narrow ? 1000 : 1500
      const phase = 1.15
      const ampAt = (y: number) =>
        inner + (outer - inner) * (0.3 + 0.62 * (0.5 + 0.5 * Math.sin(y / 253 + 1.05)))
      const gutterX = (y: number) =>
        cx + ampAt(y) * Math.sin(((2 * Math.PI * (y - startY)) / period) + phase)

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
      const dockX = Math.min(Math.max(last.x, cx + inner + 30), cx + outer - 20)
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
        g.moveTo(15 * s, 6)
        g.lineTo(31 * s, 44)
        g.lineTo(15 * s, 40)
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
        const len = (26 + 30 * thrust) * (0.8 + 0.35 * flick)
        g.save()
        g.translate(x, y)
        g.rotate(rot)
        g.scale(scaleS, scaleS)
        g.translate(ex, ey)
        // outer plume
        g.beginPath()
        g.moveTo(-7.5, 50)
        g.quadraticCurveTo(-9, 50 + len * 0.55, 0, 50 + len)
        g.quadraticCurveTo(9, 50 + len * 0.55, 7.5, 50)
        g.closePath()
        g.fillStyle = pal.flame
        g.globalAlpha = 0.85
        g.fill()
        // inner core
        g.beginPath()
        g.moveTo(-4, 50)
        g.quadraticCurveTo(-5, 50 + len * 0.4, 0, 50 + len * 0.6)
        g.quadraticCurveTo(5, 50 + len * 0.4, 4, 50)
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

    const drawPad = (x: number, y: number, alpha: number, pal: (typeof PAL)['light']) => {
      if (alpha <= 0.01) return
      const g = ctx
      g.save()
      g.globalAlpha = alpha
      g.strokeStyle = pal.ink
      g.lineWidth = 2.5
      g.beginPath()
      g.moveTo(x - 46, y)
      g.lineTo(x + 46, y)
      g.stroke()
      g.lineWidth = 1.5
      for (const sx of [-38, -13, 13, 38]) {
        g.beginPath()
        g.moveTo(x + sx, y)
        g.lineTo(x + sx, y + 7)
        g.stroke()
      }
      g.fillStyle = pal.red
      for (const bx of [-52, 52]) {
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
      const scrollY = window.scrollY

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

      // pad + dock platforms (world space)
      const padF = 1 - smoothstep(0.012, 0.05, p)
      drawPad(path[0].x, path[0].y - sy + 58 * scaleS + 6, padF, pal)
      const dockF = smoothstep(0.955, 1.0, p)
      // landing pad meets the detached engine: engine bottom sits at +92·s
      if (dockF > 0.01) drawPad(dock.x, dock.y - sy + 92 * scaleS + 6, dockF, pal)

      // ship pose
      const u = Math.max(0, Math.min(1, p))
      const pos = pathPoint(u)
      const ahead = pathPoint(Math.min(1, u + 0.012))
      const behind = pathPoint(Math.max(0, u - 0.012))
      const tangent = Math.atan2(ahead.y - behind.y, ahead.x - behind.x)
      // nose follows the tangent for the launch arc, then pitches up and
      // stays nose-up for the tail-first meander + landing (rotation 0)
      const nose = smoothstep(joinFrac * 0.7, joinFrac * 1.15, u)
      let rot = tangent + Math.PI / 2
      // blend the long way that keeps the nose swinging through horizontal
      let base = rot
      const upright = 0
      if (nose > 0) {
        let delta = upright - base
        while (delta > Math.PI) delta -= 2 * Math.PI
        while (delta < -Math.PI) delta += 2 * Math.PI
        base = base + delta * nose
      }
      rot = base

      const swayF = smoothstep(0.02, 0.06, p) * (1 - smoothstep(0.945, 0.985, p))
      const a = swayAmp * activity * swayF
      const swx = Math.sin(u * 46 - t * 1.5) * a
      const swy = Math.sin(u * 27 + t * 1.05) * a
      const thrust = smoothstep(0.015, 0.05, p) * (1 - smoothstep(0.95, 0.985, p))
      const flick = 0.5 + 0.5 * Math.sin(t * 21) * activity

      drawShip(pos.x + swx, pos.y - sy + swy, rot, dockF, thrust, flick, pal, outline)
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
