'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

/**
 * The fleet — a ship-mosaic "ASCII" portrait of the GitHub avatar.
 *
 * On load, ships from free space all over the document are attracted to the
 * right side of the hero and lock into a grid that reproduces the profile
 * photo: bright cells -> red ships (with rare blue wingmen), cells darker
 * than the photo's background -> ink/paper ships, background -> empty space.
 *
 * Scrolling down breaks formation and the ships disperse across the page;
 * scrolling back up, they rush home. Dispersal is content-aware: scatter
 * anchors live inside "negative space" zones computed by row-scanning the
 * document and subtracting every content rect (.page-col, the hero copy
 * container, the ticker), so a settled fleet never covers text. Ships live
 * in document space and ride the page (viewport y = docY − scrollY), and
 * each ship's wander amplitude is fitted to its zone so it can never drift
 * out of free space. Hovering (or tapping, on touch) the formed portrait
 * parts the fleet around the cursor (radial push + a little swirl); the
 * spring settles it back.
 *
 * One fixed 2D canvas above the page layer — per-ship SVG DOM would be far
 * too heavy at this ship count.
 *
 * Fallbacks: avatar fails to load -> the orbit-d mark sampled the same way;
 * reduced motion -> static formed portrait (no loop, hidden past the hero).
 */

type Ship = {
  hx: number; hy: number          // formation home (doc space)
  sx: number; sy: number          // scatter anchor (doc space)
  ax: number; ay: number          // scatter wander amplitude
  fx: number; fy: number; ph: number
  delay: number                   // intro attraction delay (s)
  stag: number                    // dissolve stagger 0..1
  v: 0 | 1 | 2                    // variant: rocket / fighter / saucer
  band: 0 | 1 | 2                 // 0 bright, 1 mid accent, 2 dark
  w: number                       // size weight
  jr: number                      // static rotation jitter (formation)
  spin: number                    // scatter spin base (rad/s)
  px: number; py: number          // spring position (viewport space)
  vx: number; vy: number          // spring velocity
}

type Grid = { cells: { cx: number; cy: number; dark: boolean; w: number }[]; cols: number; rows: number }

const VARIANTS = ['rocket', 'fighter', 'saucer'] as const

function bandColors(dark: boolean) {
  return dark
    ? { bright: '#fc3d21', mid: '#8fb2f2', dark: '#ede7d8' }
    : { bright: '#fc3d21', mid: '#0b3d91', dark: '#201d17' }
}

/** Downsample an image source into the ship grid (same pipeline as QA proto). */
function sampleGrid(src: CanvasImageSource, sw: number, sh: number, sampleCols: number): Grid {
  const rows0 = Math.max(2, Math.round((sampleCols * sh) / sw))
  const oc = document.createElement('canvas')
  oc.width = sampleCols
  oc.height = rows0
  const octx = oc.getContext('2d', { willReadFrequently: true })
  if (!octx) throw new Error('no 2d')
  octx.drawImage(src, 0, 0, sampleCols, rows0)
  const data = octx.getImageData(0, 0, sampleCols, rows0).data
  const lum = (i: number) => (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255
  const n = sampleCols * rows0
  // background = histogram mode (the dominant backdrop of the photo)
  const hist = new Array(64).fill(0)
  for (let i = 0; i < n; i++) hist[Math.min(63, Math.floor(lum(i * 4) * 64))]++
  let bgBin = 0
  for (let b = 1; b < 64; b++) if (hist[b] > hist[bgBin]) bgBin = b
  const bg = (bgBin + 0.5) / 64
  const upTH = 0.15, dnTH = 0.045
  const cells: Grid['cells'] = []
  let minX = sampleCols, maxX = -1, minY = rows0, maxY = -1
  for (let cy = 0; cy < rows0; cy++) {
    for (let cx = 0; cx < sampleCols; cx++) {
      const L = lum((cy * sampleCols + cx) * 4)
      const d = L - bg
      let w = 0
      let dark = false
      if (d > upTH) w = Math.min(1, d / 0.45)
      else if (d < -dnTH) { w = Math.min(1, -d / 0.16); dark = true }
      else continue
      cells.push({ cx, cy, dark, w: Math.max(0.5, w) })
      if (cx < minX) minX = cx
      if (cx > maxX) maxX = cx
      if (cy < minY) minY = cy
      if (cy > maxY) maxY = cy
    }
  }
  if (maxX < 0) throw new Error('empty grid')
  minX = Math.max(0, minX - 1); maxX = Math.min(sampleCols - 1, maxX + 1)
  minY = Math.max(0, minY - 1); maxY = Math.min(rows0 - 1, maxY + 1)
  return {
    cells: cells
      .filter(c => c.cx >= minX && c.cx <= maxX && c.cy >= minY && c.cy <= maxY)
      .map(c => ({ ...c, cx: c.cx - minX, cy: c.cy - minY })),
    cols: maxX - minX + 1,
    rows: maxY - minY + 1,
  }
}

/** The orbit-d mark, drawn at 256 so the same sampler can eat it on failure. */
function markCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const g = c.getContext('2d')!
  g.fillStyle = '#f5efe1'
  g.fillRect(0, 0, 256, 256)
  g.strokeStyle = '#201d17'
  g.lineWidth = 20
  g.lineCap = 'butt'
  g.beginPath()
  g.arc(128, 135, 44, 0, Math.PI * 2)
  g.stroke()
  g.beginPath()
  g.arc(128, 135, 84, -0.409, 4.653, false)
  g.stroke()
  g.beginPath()
  g.moveTo(172, 179)
  g.lineTo(172, 27)
  g.stroke()
  return c
}

export default function ShipCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pathname = usePathname()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx0 = canvas.getContext('2d', { alpha: true })
    if (!ctx0) return
    const ctx = ctx0 // hoisted closures below can't track the guard — TS quirk

    // Non-home routes have no hero to anchor the formation — stand down.
    const heroEl = () => document.querySelector('.hero') as HTMLElement | null
    if (pathname !== '/' && !heroEl()) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      return
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    let disposed = false
    let teardown: (() => void) | null = null

    void (async () => {
      try {
        // avatar first (same-origin public copy), mark glyph as fallback
        let grid: Grid
        try {
          const img = new Image()
          await new Promise<void>((res, rej) => {
            img.onload = () => res()
            img.onerror = () => rej(new Error('avatar load failed'))
            img.src = '/avatar.jpg'
          })
          grid = sampleGrid(img, img.naturalWidth, img.naturalHeight, 72)
        } catch {
          const mc = markCanvas()
          grid = sampleGrid(mc, 256, 256, 72)
        }
        if (disposed) return
        teardown = initFleet(grid)
        if (disposed) teardown()
      } catch {
        /* sampling unsupported — stay silent, the page works without the fleet */
      }
    })()

    function initFleet(grid: Grid): () => void {
      let vw = window.innerWidth
      let vh = window.innerHeight
      let narrow = vw < 760
      let dead = false

      // ---- theme tracking (sprite colours swap with the palette) -------------
      let dark = document.documentElement.classList.contains('dark')
      const themeObserver = new MutationObserver(() => {
        const d = document.documentElement.classList.contains('dark')
        if (d !== dark) {
          dark = d
          buildSprites()
        }
      })
      themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

      // ---- layout: anchor the formation to the hero's right side -------------
      let pitch = 6
      let artW = 200
      let anchorX = 0
      let anchorY = 0      // document space — the frame subtracts scrollY
      let heroH = 700
      let docH = 1000

      // ---- no-fly zones: the document's free space, for safe dispersal --------
      type Zone = { x0: number; y0: number; x1: number; y1: number; area: number }
      type Rect = { x0: number; y0: number; x1: number; y1: number }
      let zones: Zone[] = []

      const computeZones = () => {
        docH = Math.max(
          document.documentElement.scrollHeight,
          document.body?.scrollHeight ?? 0,
          vh
        )
        const rects: Rect[] = []
        // on narrow screens the 680 column is full-width — inset content rects
        // by its padding so ships may hold the clean paper margins instead
        const insetX = narrow ? 22 : 0
        const grab = (el: Element) => {
          const r = el.getBoundingClientRect()
          if (r.width < 4 || r.height < 4) return
          rects.push({
            x0: r.left + insetX,
            y0: r.top + window.scrollY,
            x1: r.right - insetX,
            y1: r.bottom + window.scrollY,
          })
        }
        document.querySelectorAll('.page-col').forEach(grab)
        document.querySelectorAll('.ticker').forEach(grab)
        // hero copy container (max-w-[680px] inside the full-bleed hero)
        document.querySelectorAll('.max-w-\\[680px\\]').forEach(grab)

        // row-scan the document, subtract content, keep the free intervals
        const ROW = 8
        const M = 8 // viewport margin
        const rows: { y0: number; iv: [number, number][] }[] = []
        for (let y = 0; y < docH; y += ROW) {
          const y1 = Math.min(docH, y + ROW)
          let iv: [number, number][] = [[M, vw - M]]
          for (const r of rects) {
            if (r.y1 <= y || r.y0 >= y1) continue
            const out: [number, number][] = []
            for (const [a, b] of iv) {
              if (r.x1 <= a || r.x0 >= b) { out.push([a, b]); continue }
              if (r.x0 > a) out.push([a, Math.min(b, r.x0)])
              if (r.x1 < b) out.push([Math.max(a, r.x1), b])
            }
            iv = out
            if (!iv.length) break
          }
          if (iv.length) rows.push({ y0: y, iv })
        }

        // merge runs of identical rows into zones, one rectangle per interval
        const found: Zone[] = []
        let cur: { y0: number; y1: number; iv: [number, number][] } | null = null
        const same = (a: [number, number][], b: [number, number][]) =>
          a.length === b.length && a.every((it, i) => it[0] === b[i][0] && it[1] === b[i][1])
        const emit = (z: { y0: number; y1: number; iv: [number, number][] }) => {
          const minSpan = narrow ? 12 : 26 // mobile ships are ~3px — narrow strips hold
          for (const [a, b] of z.iv) {
            const w = b - a
            const h = z.y1 - z.y0
            if (w < minSpan || h < minSpan) continue
            found.push({ x0: a, y0: z.y0, x1: b, y1: z.y1, area: w * h })
          }
        }
        for (const row of rows) {
          if (cur && same(cur.iv, row.iv)) cur.y1 = row.y0 + ROW
          else {
            if (cur) emit(cur)
            cur = { y0: row.y0, y1: row.y0 + ROW, iv: row.iv }
          }
        }
        if (cur) emit(cur)

        // cap: keep the largest zones
        found.sort((p, q) => q.area - p.area)
        zones = found.length > 220 ? found.slice(0, 220) : found
      }

      const layout = () => {
        vw = window.innerWidth
        vh = window.innerHeight
        narrow = vw < 760
        const artH = narrow ? 175 : vw < 1100 ? 310 : 380
        pitch = artH / grid.rows
        artW = pitch * grid.cols
        const hero = heroEl()
        const heroTop = hero ? hero.getBoundingClientRect().top + window.scrollY : 0
        heroH = hero ? hero.offsetHeight : 700
        anchorX = vw - (narrow ? 10 : 26) - artW
        anchorY = heroTop + (narrow ? 52 : 84)
        computeZones()
        buildSprites()
        assignHomes(ships.length > 0)
      }

      // ---- sprites (variant × band, drawn at device scale) -------------------
      const sprites: Record<string, HTMLCanvasElement> = {}
      const buildSprites = () => {
        const pal = bandColors(dark)
        const ss = Math.max(1, Math.min(3, Math.round(window.devicePixelRatio || 1)))
        const sp = Math.ceil(pitch * 1.5 * ss)
        for (const v of [0, 1, 2]) {
          for (const band of [0, 1, 2]) {
            const s = document.createElement('canvas')
            s.width = sp
            s.height = sp
            const g = s.getContext('2d')!
            g.translate(sp / 2, sp / 2)
            g.scale(ss, ss)
            g.fillStyle = pal[band === 0 ? 'bright' : band === 1 ? 'mid' : 'dark']
            const h = pitch * 1.35
            const w = pitch * 1.15
            if (v === 0) {
              // rocket: nose, swept fins, tail
              g.beginPath()
              g.moveTo(0, -h * 0.5); g.lineTo(w * 0.30, h * 0.12); g.lineTo(w * 0.22, h * 0.16)
              g.lineTo(w * 0.46, h * 0.34); g.lineTo(w * 0.22, h * 0.30); g.lineTo(w * 0.22, h * 0.40)
              g.lineTo(-w * 0.22, h * 0.40); g.lineTo(-w * 0.22, h * 0.30); g.lineTo(-w * 0.46, h * 0.34)
              g.lineTo(-w * 0.22, h * 0.16); g.lineTo(-w * 0.30, h * 0.12)
              g.closePath(); g.fill()
            } else if (v === 1) {
              // fighter: swept delta
              g.beginPath()
              g.moveTo(0, -h * 0.5); g.lineTo(w * 0.5, h * 0.34); g.lineTo(w * 0.16, h * 0.30)
              g.lineTo(0, h * 0.16); g.lineTo(-w * 0.16, h * 0.30); g.lineTo(-w * 0.5, h * 0.34)
              g.closePath(); g.fill()
            } else {
              // saucer: hull + dome
              g.beginPath(); g.ellipse(0, h * 0.12, w * 0.5, h * 0.2, 0, 0, Math.PI * 2); g.fill()
              g.beginPath(); g.arc(0, h * 0.02, w * 0.22, Math.PI, 0); g.fill()
            }
            sprites[`${v}${band}`] = s
          }
        }
      }

      // ---- the fleet ----------------------------------------------------------
      let ships: Ship[] = []
      let introTotal = 1.6

      const assignHomes = (preserve = false) => {
        const prev = ships
        const cx0 = anchorX + artW / 2
        const cy0 = anchorY + (pitch * grid.rows) / 2
        const diag = Math.hypot(vw, docH)
        const N = grid.cells.length
        const zoneTotal = zones.reduce((a, z) => a + z.area, 0)

        // per-zone lattice (even coverage instead of random clumping)
        const lattice = zones.map(z => {
          const exp = Math.max(1, Math.round((z.area / zoneTotal) * N))
          const zw = z.x1 - z.x0
          const zh = z.y1 - z.y0
          const gx = Math.max(1, Math.round(Math.sqrt((exp * zw) / zh)))
          const gy = Math.max(1, Math.ceil(exp / gx))
          return { gx, gy, k: 0 }
        })
        let zAcc = 0
        let zi = 0

        ships = grid.cells.map((cell, i) => {
          const hash = (cell.cx * 73856093 ^ cell.cy * 19349663) >>> 0
          const hx = anchorX + cell.cx * pitch + pitch / 2
          const hy = anchorY + cell.cy * pitch + pitch / 2

          // scatter anchor: inside a content-free zone, on a jittered lattice
          let sx: number, sy: number, ax: number, ay: number
          if (zones.length && zoneTotal > 0) {
            const target = ((i + 0.5) / N) * zoneTotal
            while (zi < zones.length - 1 && zAcc + zones[zi].area < target) {
              zAcc += zones[zi].area
              zi++
            }
            const z = zones[zi]
            const L = lattice[zi]
            const col = L.k % L.gx
            const row = Math.floor(L.k / L.gx) % L.gy
            L.k++
            const zw = z.x1 - z.x0
            const zh = z.y1 - z.y0
            const cw = zw / L.gx
            const ch = zh / L.gy
            const jx = ((hash % 1000) / 1000 - 0.5) * 0.5
            const jy = (((hash >>> 7) % 1000) / 1000 - 0.5) * 0.5
            // narrow strips: tighter inset so the wander can never reach content
            const pad = narrow ? 5 : 8
            sx = Math.min(z.x1 - pad, Math.max(z.x0 + pad, z.x0 + (col + 0.5 + jx) * cw))
            sy = Math.min(z.y1 - pad, Math.max(z.y0 + pad, z.y0 + (row + 0.5 + jy) * ch))
            // wander amplitude fitted to the zone: the ship can never leave free space
            const margin = narrow ? 6 : 10
            ax = Math.max(0, Math.min(sx - z.x0, z.x1 - sx) - margin)
            ay = Math.max(0, Math.min(sy - z.y0, z.y1 - sy) - margin)
            ax = Math.min(ax, 120)
            ay = Math.min(ay, 120)
          } else {
            // fallback: viewport-wide scatter, anchored in document space
            sx = 16 + (hash % 1000 / 1000) * (vw - 32)
            sy = 16 + ((hash >>> 10) % 1000 / 1000) * (Math.max(docH, vh) - 32)
            ax = 26 + ((hash >>> 4) % 40)
            ay = 26 + ((hash >>> 6) % 40)
          }

          const ship: Ship = {
            hx, hy,
            sx, sy,
            ax, ay,
            fx: 0.12 + ((hash >>> 8) % 20) / 100,
            fy: 0.12 + ((hash >>> 12) % 20) / 100,
            ph: (hash % 628) / 100,
            delay: 0.12 + (Math.hypot(hx - cx0, hy - cy0) / diag) * 0.65 + ((hash >>> 14) % 100) / 500,
            stag: (hash % 1000) / 1000,
            v: (hash % 3) as 0 | 1 | 2,
            band: (cell.dark ? 2 : hash % 100 < 8 ? 1 : 0) as 0 | 1 | 2,
            w: cell.w,
            jr: (((hash >>> 16) % 9) - 4) * 0.055,
            spin: (((hash >>> 3) % 10) / 10 - 0.5) * 1.1,
            px: sx, py: sy, vx: 0, vy: 0,
          }
          const old = preserve && prev[i] ? prev[i] : null
          if (old) {
            ship.px = old.px; ship.py = old.py
            ship.vx = old.vx; ship.vy = old.vy
          }
          return ship
        })
        introTotal = Math.max(...ships.map(s => s.delay), 0) + 1.05
      }

      // ---- canvas sizing -------------------------------------------------------
      const cv = canvas! // guarded by the null-check above; hoisted fn confuses TS
      const size = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        cv.width = Math.round(vw * dpr)
        cv.height = Math.round(vh * dpr)
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      }

      // ---- pointer: part the formed fleet around the cursor --------------------
      // touch/pen included: a tap on the artwork scatters the fleet for a
      // moment (the browser cancels drag pointers once scrolling takes over,
      // so a coarse pointer is held alive briefly after pointerdown)
      const coarse = window.matchMedia('(pointer: coarse)').matches
      const ptr = { x: -1e4, y: -1e4, on: false }
      let holdTimer = 0
      const onPtrMove = (e: PointerEvent) => {
        ptr.x = e.clientX
        ptr.y = e.clientY
        ptr.on = true
      }
      const onPtrGone = () => {
        ptr.on = false
      }
      const onPtrDown = (e: PointerEvent) => {
        ptr.x = e.clientX
        ptr.y = e.clientY
        ptr.on = true
        window.clearTimeout(holdTimer)
        if (e.pointerType !== 'mouse') holdTimer = window.setTimeout(onPtrGone, 900)
      }

      // ---- frame ---------------------------------------------------------------
      const clock = { last: 0, t: 0 }
      const frame = (now: number) => {
        raf = requestAnimationFrame(frame)
        if (dead) return
        const dt = Math.min(0.05, clock.last ? (now - clock.last) / 1000 : 0.016)
        clock.last = now
        clock.t += dt
        const t = clock.t

        const scrollY = window.scrollY
        // formation factor: 1 at the top, 0 once the hero has scrolled away
        const scrollF = Math.max(0, Math.min(1, scrollY / (heroH * 0.85)))
        const introDone = t > introTotal

        // hover is active only over the artwork (portrait bbox + a little slack)
        const artH = pitch * grid.rows
        const artY0 = anchorY - scrollY
        const inArt =
          ptr.on &&
          ptr.x > anchorX - 50 && ptr.x < anchorX + artW + 50 &&
          ptr.y > artY0 - 50 && ptr.y < artY0 + artH + 50
        const R = (narrow ? 78 : 116) * (coarse ? 1.25 : 1)

        ctx.clearRect(0, 0, vw, vh)
        for (const s of ships) {
          // per-ship dissolve: the fleet lets go in a staggered cascade
          const raw = scrollF * 1.35 - s.stag * 0.35
          const sSc = Math.max(0, Math.min(1, raw)) ** 1.4
          const introF = introDone ? 1 : Math.max(0, Math.min(1, (t - s.delay) / 0.85))
          const sEff = Math.min(introF, sSc)

          // target: hover at home vs wander scattered — document space rides scroll
          const hx = s.hx + Math.sin(t * 0.9 + s.ph) * 1.2
          const hy = s.hy - scrollY + Math.cos(t * 0.8 + s.ph * 1.7) * 1.2
          const wx = s.sx + Math.sin(t * s.fx + s.ph) * s.ax
          const wy = s.sy - scrollY + Math.cos(t * s.fy + s.ph * 1.3) * s.ay
          let tx = hx + (wx - hx) * sEff
          let ty = hy + (wy - hy) * sEff

          // hover repulsion: radial push + a clockwise swirl, eased by the spring
          if (inArt && sEff < 0.6) {
            const dx = s.px - ptr.x
            const dy = s.py - ptr.y
            const d2 = dx * dx + dy * dy
            if (d2 < R * R && d2 > 0.01) {
              const d = Math.sqrt(d2)
              const f = 1 - d / R
              const push = f * 80
              const swirl = f * f * 40
              const nx = dx / d
              const ny = dy / d
              tx += nx * push - ny * swirl
              ty += ny * push + nx * swirl
            }
          }

          // spring (slightly underdamped: rushes home with a soft overshoot)
          const dmp = Math.exp(-6.2 * dt)
          s.vx += (tx - s.px) * 34 * dt
          s.vy += (ty - s.py) * 34 * dt
          s.vx *= dmp
          s.vy *= dmp
          s.px += s.vx * dt
          s.py += s.vy * dt

          const spr = sprites[`${s.v}${s.band}`]
          if (!spr) continue
          // scattered ships swell a little — the dispersal reads on every
          // screen size; the formed portrait keeps its exact mosaic size
          const size2 =
            pitch * (0.62 + 0.55 * s.w) * (s.band === 2 ? 0.75 + ((s.stag * 997) % 100) / 180 : 1) *
            (1 + 0.55 * sEff)
          const rot = s.jr * (1 - sEff) + (s.spin + Math.sin(t * 0.35 + s.ph) * 0.55) * sEff
          ctx.globalAlpha = 1 - 0.12 * sEff
          if (Math.abs(rot) < 0.02) {
            ctx.drawImage(spr, s.px - size2 / 2, s.py - size2 / 2, size2, size2)
          } else {
            ctx.save()
            ctx.translate(s.px, s.py)
            ctx.rotate(rot)
            ctx.drawImage(spr, -size2 / 2, -size2 / 2, size2, size2)
            ctx.restore()
          }
        }
        ctx.globalAlpha = 1
      }

      // ---- reduced motion: one static formed portrait, hidden past the hero ----
      if (reduced) {
        layout()
        size()
        for (const s of ships) { s.px = s.hx; s.py = s.hy - window.scrollY }
        drawStatic()
        const onScrollRm = () => {
          cv.style.opacity = window.scrollY > heroH * 0.8 ? '0' : '1'
          drawStatic()
        }
        window.addEventListener('scroll', onScrollRm, { passive: true })
        return () => {
          dead = true
          window.removeEventListener('scroll', onScrollRm)
          themeObserver.disconnect()
        }
      }

      function drawStatic() {
        const sy = window.scrollY
        ctx.clearRect(0, 0, vw, vh)
        for (const s of ships) {
          const spr = sprites[`${s.v}${s.band}`]
          if (!spr) continue
          const size2 = pitch * (0.62 + 0.55 * s.w) * (s.band === 2 ? 0.75 + ((s.stag * 997) % 100) / 180 : 1)
          ctx.globalAlpha = 1
          ctx.save()
          ctx.translate(s.hx + ((s.stag * 8191) % 5) / 8 - 0.25, s.hy - sy + ((s.spin * 9973) % 5) / 8 - 0.25)
          ctx.rotate(s.jr)
          ctx.drawImage(spr, -size2 / 2, -size2 / 2, size2, size2)
          ctx.restore()
        }
        ctx.globalAlpha = 1
      }

      // ---- lifecycle ------------------------------------------------------------
      layout()
      size()
      document.documentElement.dataset.ships = 'on'
      window.addEventListener('pointermove', onPtrMove, { passive: true })
      window.addEventListener('pointerdown', onPtrDown, { passive: true })
      document.documentElement.addEventListener('pointerleave', onPtrGone)
      window.addEventListener('blur', onPtrGone)
      raf = requestAnimationFrame(frame)

      let lastW = vw
      let lastDocH = document.documentElement.scrollHeight
      let rebuildTimer = 0
      const schedule = () => {
        window.clearTimeout(rebuildTimer)
        rebuildTimer = window.setTimeout(() => {
          if (dead) return
          const w = window.innerWidth
          const dh = document.documentElement.scrollHeight
          if (Math.abs(w - lastW) > 4 || Math.abs(dh - lastDocH) > 200) {
            lastW = w
            lastDocH = dh
            layout()
            size()
          }
        }, 160)
      }
      window.addEventListener('resize', schedule)
      const onVis = () => {
        if (document.hidden) {
          cancelAnimationFrame(raf)
          clock.last = 0
        } else if (!dead) {
          raf = requestAnimationFrame(frame)
        }
      }
      document.addEventListener('visibilitychange', onVis)
      if (document.fonts) document.fonts.ready.then(schedule).catch(() => {})

      return () => {
        dead = true
        cancelAnimationFrame(raf)
        window.removeEventListener('resize', schedule)
        window.removeEventListener('pointermove', onPtrMove)
        window.removeEventListener('pointerdown', onPtrDown)
        window.clearTimeout(holdTimer)
        document.documentElement.removeEventListener('pointerleave', onPtrGone)
        window.removeEventListener('blur', onPtrGone)
        document.removeEventListener('visibilitychange', onVis)
        window.clearTimeout(rebuildTimer)
        themeObserver.disconnect()
        delete document.documentElement.dataset.ships
      }
    }

    return () => {
      disposed = true
      teardown?.()
    }
  }, [pathname])

  return <canvas ref={canvasRef} className="ships-canvas" aria-hidden="true" />
}
