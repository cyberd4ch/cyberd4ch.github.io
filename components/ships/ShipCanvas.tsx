'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { fleetBus } from '@/lib/fleetBus'

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
  hx: number; hy: number          // formation home (doc space; viewport space on stage)
  sx: number; sy: number          // scatter anchor (doc space; off-screen ring on stage)
  ax: number; ay: number          // scatter wander amplitude
  fx: number; fy: number; ph: number
  delay: number                   // intro attraction delay (s)
  stag: number                    // dissolve stagger 0..1
  v: 0 | 1 | 2                    // variant: rocket / fighter / saucer
  band: 0 | 1 | 2 | 3 | 4        // 0 red skin, 1 navy accent, 2 ink, 3 hat tint, 4 eye white
  w: number                       // size weight
  cyf: number                     // cell row as a fraction of the art height (0 top .. 1 bottom)
  eye: 0 | 1                      // inside the blink band
  ord: number                     // draw-order rank: skin 0, hat 1, whites 2, ink 3
  jr: number                      // static rotation jitter (formation)
  spin: number                    // scatter spin base (rad/s)
  px: number; py: number          // spring position (viewport space)
  vx: number; vy: number          // spring velocity
}

type Grid = {
  cells: { cx: number; cy: number; cyf: number; dark: boolean; hat: boolean; wt: boolean; w: number }[]
  cols: number
  rows: number
}

const VARIANTS = ['rocket', 'fighter', 'saucer'] as const

// blink band: eye rows as a fraction of the (head-cropped) art height —
// calibrated against the avatar's actual geometry, see qa-shots previews
const EYE0 = 0.46
const EYE1 = 0.76 // covers the full lens circles (they reach head row ~50)

function bandColors(dark: boolean) {
  return dark
    ? { bright: '#fc3d21', mid: '#8fb2f2', dark: '#ede7d8', tint: '#e0c9a4', wt: '#070c16' }
    : { bright: '#fc3d21', mid: '#0b3d91', dark: '#201d17', tint: '#e6b98c', wt: '#f5efe1' }
}

/**
 * Downsample an image source into the ship grid (same pipeline as the QA
 * preview harness, qa-shots/sample-preview.js). The source is head-cropped —
 * the avatar is a bust portrait, so the crop throws away the empty navy
 * margins and most of the suit, filling the frame with the head. Cells
 * classify as (thresholds calibrated against the avatar's real pixels):
 *  - dark: well below the backdrop luminance, or a neutral mid-gray —
 *    pupils, brows, glasses frames, line art, collar. Drawn small and last,
 *    so features stay crisp on top of the skin mass.
 *  - wt: near-white and warm — eye/lens whites. Rendered as paper-coloured
 *    "hole" ships (band 4) so they read as light inside the face.
 *  - hat: bright but very low-saturation — pale felt AND the blown-out
 *    highlights of the face. The split from skin is saturation, not
 *    luminance: both sit at L≈0.90.
 *  - otherwise skin: warm + brighter than the backdrop, drawn large — the
 *    face's mass. Cool bright cells (blue backdrop) drop as background.
 *
 * The glasses (and now the nose + mouth, which sit in the same centered
 * strip) get a second pass: the feature box is re-sampled at 2× and its
 * cells (fractional grid coords) replace the head-resolution ones — a lens
 * is ~4 cells wide in the head grid, which no amount of styling can make
 * read as an eye.
 */
function sampleGrid(src: CanvasImageSource, sw: number, sh: number, sampleCols: number): Grid {
  const sX = sw * 0.22
  const sY = sh * 0.155
  const sW = sw * 0.48
  const sH = sh * 0.465
  const rows0 = Math.max(2, Math.round((sampleCols * sH) / sW))
  const oc = document.createElement('canvas')
  oc.width = sampleCols
  oc.height = rows0
  const octx = oc.getContext('2d', { willReadFrequently: true })
  if (!octx) throw new Error('no 2d')
  octx.drawImage(src, sX, sY, sW, sH, 0, 0, sampleCols, rows0)
  const data = octx.getImageData(0, 0, sampleCols, rows0).data

  // shared per-pixel classifier: warm+L thresholds against one backdrop
  const classify = (d: Uint8ClampedArray, W: number, H: number, bg: number) => {
    const out: { cx: number; cy: number; dark: boolean; hat: boolean; wt: boolean; w: number }[] = []
    for (let cy = 0; cy < H; cy++) {
      for (let cx = 0; cx < W; cx++) {
        const i = (cy * W + cx) * 4
        const L = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255
        const dd = L - bg
        const mx = Math.max(d[i], d[i + 1], d[i + 2])
        const mn = Math.min(d[i], d[i + 1], d[i + 2])
        const sat = mx > 0 ? (mx - mn) / mx : 0
        let w = 0
        let dark = false
        let hat = false
        let wt = false
        if ((dd < -0.07 && sat <= 0.5) || (sat < 0.22 && L < 0.75 && dd < 0.5)) {
          // below the backdrop, or a neutral mid-gray: the ink family
          w = Math.min(1, Math.max(0.5, (bg - L) / 0.14))
          dark = true
        } else if (d[i] > d[i + 2] && sat >= 0.25 && L < 0.45) {
          // warm dark: the hair (brown, only marginally darker than the navy
          // backdrop in luminance — the cool/warm split is what separates it
          // from the background, whose blue always has B > R)
          w = Math.min(1, Math.max(0.5, (bg - L) / 0.14))
          dark = true
        } else if (dd > 0.09 && (d[i] > d[i + 2] || L >= 0.95)) {
          // warm + brighter than the backdrop: the skin family splits by
          // saturation — pale felt and lens whites vs the face. Pure-white
          // lens pixels are neutral (R == B) so brightness alone qualifies
          if (L >= 0.95) {
            wt = true
            w = 1
          } else if (sat < 0.1) {
            hat = true
            w = Math.min(1, dd / 0.35)
          } else {
            w = Math.min(1, dd / 0.35)
          }
        } else continue
        out.push({ cx, cy, dark, hat, wt, w })
      }
    }
    return out
  }

  // background = histogram mode (the dominant backdrop of the crop)
  const lum = (i: number) => (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255
  const n = sampleCols * rows0
  const hist = new Array(64).fill(0)
  for (let i = 0; i < n; i++) hist[Math.min(63, Math.floor(lum(i * 4) * 64))]++
  let bgBin = 0
  for (let b = 1; b < 64; b++) if (hist[b] > hist[bgBin]) bgBin = b
  const bg = (bgBin + 0.5) / 64

  const head = classify(data, sampleCols, rows0, bg)

  // ---- face patch: re-sample the feature box at 2× -------------------------
  // box in head-grid units (fractions of the 76×74 head grid, calibrated on
  // the avatar: brow line through the lenses, down past the nose outline
  // (head rows ~44–54) to the mouth (~56–62)), sampled fine and spliced in
  // with fractional coordinates
  const bx0 = Math.round(sampleCols * (24 / 76))
  const bx1 = Math.round(sampleCols * (48 / 76))
  const by0 = Math.round(rows0 * (30 / 74))
  const by1 = Math.round(rows0 * (62 / 74))
  const PCOLS = Math.max(4, (bx1 - bx0) * 2)
  const pW = ((bx1 - bx0) / sampleCols) * sW
  const pH = ((by1 - by0) / rows0) * sH
  const PROWS = Math.max(2, Math.round((PCOLS * pH) / pW))
  const pc = document.createElement('canvas')
  pc.width = PCOLS
  pc.height = PROWS
  const pctx = pc.getContext('2d', { willReadFrequently: true })
  if (!pctx) throw new Error('no 2d')
  pctx.drawImage(src, sX + (bx0 / sampleCols) * sW, sY + (by0 / rows0) * sH, pW, pH, 0, 0, PCOLS, PROWS)
  const pdata = pctx.getImageData(0, 0, PCOLS, PROWS).data
  const patch = classify(pdata, PCOLS, PROWS, bg)
  const stepX = (bx1 - bx0) / PCOLS
  const stepY = (by1 - by0) / PROWS
  const cells0 = head.filter(
    c => !(c.cx > bx0 && c.cx < bx1 && c.cy > by0 && c.cy < by1) // strictly inside: superseded
  )
  cells0.push(
    ...patch.map(c => ({
      ...c,
      // fine cell centre in head-grid coordinates (home = (cx+0.5)*pitch)
      cx: bx0 + (c.cx + 0.5) * stepX - 0.5,
      cy: by0 + (c.cy + 0.5) * stepY - 0.5,
    }))
  )

  let minX = sampleCols, maxX = -1, minY = rows0, maxY = -1
  for (const c of cells0) {
    if (c.cx < minX) minX = c.cx
    if (c.cx > maxX) maxX = c.cx
    if (c.cy < minY) minY = c.cy
    if (c.cy > maxY) maxY = c.cy
  }
  if (maxX < 0) throw new Error('empty grid')
  minX = Math.max(0, minX - 1); maxX = Math.min(sampleCols - 1, maxX + 1)
  minY = Math.max(0, minY - 1); maxY = Math.min(rows0 - 1, maxY + 1)
  const cols = maxX - minX + 1
  const rows = maxY - minY + 1
  return {
    cells: cells0
      .filter(c => c.cx >= minX && c.cx <= maxX && c.cy >= minY && c.cy <= maxY)
      .map(c => ({
        ...c,
        cx: c.cx - minX,
        cy: c.cy - minY,
        // global art fraction 0..1 — drives the blink band + idle gestures
        cyf: rows > 1 ? (c.cy - minY) / (rows - 1) : 0,
      })),
    cols,
    rows,
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
          grid = sampleGrid(img, img.naturalWidth, img.naturalHeight, 76)
        } catch {
          const mc = markCanvas()
          grid = sampleGrid(mc, 256, 256, 76)
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
      let pitchY = 6      // vertical pitch; equals pitch unless the stage's big art
      let artW = 200
      let anchorX = 0
      let anchorY = 0      // doc space natively; viewport space on the stage
      let heroH = 700
      let docH = 1000
      // deck-timed dispersal end in scroll px; -1 = not yet measured (the
      // frame fills it in once data-deck is on and the chapter exists)
      let deckEnd = -1
      // presentation stage state (lib/fleetBus, components/deck/DeckStage)
      let stageOn = fleetBus.virtual
      let formedCur = 1    // eased toward fleetBus.formedTarget on the clock
      let idleK = 0        // eased 0..1 gate for the idle facial gestures
      let blinkAt = 3.5    // clock time of the next blink

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
        stageOn = fleetBus.virtual
        const hero = heroEl()
        const heroTop = hero ? hero.getBoundingClientRect().top + window.scrollY : 0
        heroH = hero ? hero.offsetHeight : 700
        if (narrow && stageOn) {
          // stage: the portrait IS the first screen — nearly fullscreen, the
          // face sampled at 88 columns. heroH is CSS svh-derived and stays put
          // while mobile toolbars collapse/expand (innerHeight is not), so it
          // drives the size; pitchY stretches cells vertically (capped) to
          // fill the taller aspect without widening the grid.
          pitch = Math.min(vw - 20, heroH * 0.66) / grid.cols
          pitchY = Math.min(pitch * 1.35, (heroH - 150) / grid.rows)
          artW = pitch * grid.cols
          const artH = pitchY * grid.rows
          anchorX = Math.round((vw - artW) / 2)
          anchorY = Math.round(heroTop + (heroH - artH) / 2)
        } else if (narrow) {
          // phones: the portrait IS the hero — centered on the first screen,
          // sized to fill the space between the telemetry rows (the ticker
          // strip at the hero's foot is ~34px). the hero's own height drives
          // the size because it is CSS svh-derived and stays put while mobile
          // browser toolbars collapse/expand mid-scroll (innerHeight is not,
          // and a rescaling portrait mid-scroll would read as a glitch)
          const target = Math.min(heroH * 0.47, vw - 56)
          pitch = target / grid.rows
          pitchY = pitch
          artW = pitch * grid.cols
          anchorX = Math.round((vw - artW) / 2)
          anchorY = heroTop + Math.round((heroH - 34 - pitchY * grid.rows) / 2) + 4
        } else {
          const artH = vw < 1100 ? 310 : 380
          // 76 columns would widen the desktop art past the copy column —
          // cap the width and let the art run a touch shorter instead
          pitch = Math.min(artH / grid.rows, 400 / grid.cols)
          pitchY = pitch
          artW = pitch * grid.cols
          anchorX = vw - 26 - artW
          anchorY = heroTop + 84
        }
        if (!stageOn) computeZones()
        else zones = [] // stage scatters on an off-screen ring, zones unused
        buildSprites()
        assignHomes(ships.length > 0)
        // re-measure the deck window on the next frame (geometry may differ)
        deckEnd = -1
        // live ping table for the flight layer (see lib/fleetBus)
        fleetBus.ships = ships.map(s => ({ x: s.px, y: s.py, s: 0 }))
      }

      // ---- sprites (variant × band, drawn at device scale) -------------------
      const sprites: Record<string, HTMLCanvasElement> = {}
      const spritesRot: Record<string, HTMLCanvasElement> = {}
      const buildSprites = () => {
        const pal = bandColors(dark)
        const ss = Math.max(1, Math.min(3, Math.round(window.devicePixelRatio || 1)))
        // 2.4× the cell: the largest drawn size (scattered swell × 1.55, then
        // stretchH 1.35 tall) must stay ≤ the bitmap or ships draw upscaled+blurry
        const sp = Math.ceil(Math.max(pitch, pitchY) * 2.4 * ss)
        for (const v of [0, 1, 2]) {
          for (const band of [0, 1, 2, 3, 4]) {
            const s = document.createElement('canvas')
            s.width = sp
            s.height = sp
            const g = s.getContext('2d')!
            g.translate(sp / 2, sp / 2)
            g.scale(ss, ss)
            g.fillStyle =
              band === 0 ? pal.bright :
              band === 1 ? pal.mid :
              band === 2 ? pal.dark :
              band === 3 ? pal.tint :
              pal.wt
            const B = sp / ss
            // the sprite bitmap is stretched onto size2×sizeH at draw time — the
            // shape must FILL the bitmap, or every ship renders at a fraction of
            // its nominal size and the big portrait shatters into confetti.
            // extents: rocket 0.92w×0.9h, fighter 1.0w×0.84h, saucer 1.0w×~0.55h
            const h = B / 0.9
            const w = B
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
        // pre-baked rotated variants: the formation jitter (s.jr) only ever
        // takes the 9 angles (k−4)×0.055 rad, so the formed portrait — the
        // state that draws thousands of ships every frame — can blit a
        // pre-rotated bitmap instead of paying save/translate/rotate/restore
        // per ship. Scattered flight keeps the continuous rotation path.
        for (let ji = 0; ji < 9; ji++) {
          if (ji === 4) continue // zero angle draws the base sprite
          const a = (ji - 4) * 0.055
          for (const key of Object.keys(sprites)) {
            const base = sprites[key]
            const s = document.createElement('canvas')
            s.width = sp
            s.height = sp
            const g = s.getContext('2d')!
            g.translate(sp / 2, sp / 2)
            g.rotate(a)
            g.drawImage(base, -sp / 2, -sp / 2)
            spritesRot[`${ji}|${key}`] = s
          }
        }
      }

      // ---- the fleet ----------------------------------------------------------
      let ships: Ship[] = []
      let introTotal = 1.6

      const assignHomes = (preserve = false) => {
        const prev = ships
        const cx0 = anchorX + artW / 2
        const cy0 = anchorY + (pitchY * grid.rows) / 2
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
          const hy = anchorY + cell.cy * pitchY + pitchY / 2

          // scatter anchor: inside a content-free zone, on a jittered lattice
          let sx: number, sy: number, ax: number, ay: number
          if (fleetBus.virtual) {
            // stage: the card takes the whole screen, so the fleet doesn't
            // dodge around it — it exits. Anchors sit on a ring just outside
            // the viewport; the wander keeps a few ships peeking back in, and
            // the reform reads as the swarm rushing home from off-screen.
            const m = 70
            const side = hash % 4
            if (side === 0) {
              sx = -m + ((hash % 100) / 100) * 24
              sy = (((hash >>> 5) % 1000) / 1000) * (vh + 120) - 60
            } else if (side === 1) {
              sx = vw + m - ((hash % 100) / 100) * 24
              sy = (((hash >>> 5) % 1000) / 1000) * (vh + 120) - 60
            } else if (side === 2) {
              sx = (((hash >>> 5) % 1000) / 1000) * vw
              sy = -m + ((hash >>> 9) % 100) / 100 * 24
            } else {
              sx = (((hash >>> 5) % 1000) / 1000) * vw
              sy = vh + m - ((hash >>> 9) % 100) / 100 * 24
            }
            ax = 16 + ((hash >>> 4) % 14)
            ay = 16 + ((hash >>> 6) % 14)
          } else if (zones.length && zoneTotal > 0) {
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

          const cyf = cell.cyf // global art fraction, computed at sample time
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
            band: (cell.dark ? 2 : cell.wt ? 4 : cell.hat ? 3 : hash % 100 < 8 ? 1 : 0) as 0 | 1 | 2 | 3 | 4,
            w: cell.w,
            cyf,
            eye: (cell.wt || cell.dark) && cyf >= EYE0 && cyf <= EYE1 ? 1 : 0,
            ord: cell.dark ? 3 : cell.wt ? 2 : cell.hat ? 1 : 0,
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
        // ink ships draw last so pupils/brows/smirk stay crisp over the big
        // skin mass (stable sort keeps per-cell index alignment for preserve)
        ships.sort((a, b) => a.ord - b.ord)
        introTotal = Math.max(...ships.map(s => s.delay), 0) + 1.05
      }

      // ---- canvas sizing -------------------------------------------------------
      const cv = canvas! // guarded by the null-check above; hoisted fn confuses TS
      const size = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        // pin the CSS box to innerHeight: `inset:0; height:100%` on a fixed
        // element resolves against the LARGE viewport (iOS 100vh), so an
        // innerHeight-sized bitmap gets stretched vertically — the fullscreen
        // portrait would distort and breathe as mobile toolbars toggle
        cv.style.width = vw + 'px'
        cv.style.height = vh + 'px'
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

        // stage ⇄ native transitions re-fit the formation immediately (the
        // stage's fullscreen portrait has different pitch/anchors than the
        // deck's, and entering/leaving collapses/restores the document)
        const stageNow = fleetBus.virtual
        if (stageNow !== stageOn) {
          stageOn = stageNow
          layout()
          size()
        }

        // the stage never scrolls: homes/scatter are viewport-anchored and
        // the fleet's dispersal eases toward formedTarget on the clock
        const scrollY = stageOn ? 0 : window.scrollY
        let scrollF = 0
        if (stageOn) {
          formedCur += (fleetBus.formedTarget - formedCur) * Math.min(1, dt * 3)
          if (Math.abs(fleetBus.formedTarget - formedCur) < 0.002) formedCur = fleetBus.formedTarget
        } else {
          // formation factor: 1 at the top, 0 once the hero has scrolled away.
          // in deck mode the first card arrives over ~100svh, so the dispersal
          // runs a little ahead of it and the card never fights the fleet
          const deckOn = document.documentElement.dataset.deck === 'on'
          if (deckOn && deckEnd < 0) {
            // the identity card pins at its chapter's offsetTop; the fleet
            // finishes scattering a beat before the card fully covers the
            // screen — tied to the deck's real geometry so the timing holds on
            // any device height instead of a fixed fraction of the hero
            const ch = document.querySelector<HTMLElement>('[data-chapter-first="true"]')
            const t = ch?.offsetTop ?? 0
            deckEnd = t > 0 ? Math.max(heroH * 0.5, t - vh * 0.16) : 0
          }
          const windowEnd = narrow && deckOn && deckEnd > 0 ? deckEnd : heroH * 0.85
          scrollF = Math.max(0, Math.min(1, scrollY / windowEnd))
        }
        const disp = stageOn ? 1 - formedCur : scrollF
        const introDone = t > introTotal
        fleetBus.formed = stageOn ? formedCur : 1 - scrollF

        // idle facial life: breath + sway + blinks — only on the stage, only
        // while the portrait is fully formed and untouched for a beat
        const idle =
          stageOn && introDone && formedCur > 0.985 &&
          performance.now() - fleetBus.lastInput > 1400
        idleK += ((idle ? 1 : 0) - idleK) * Math.min(1, dt * 2.5)
        let blink = 0
        if (idleK > 0.02) {
          if (t >= blinkAt) {
            const bp = (t - blinkAt) / 0.26
            if (bp >= 1) blinkAt = t + 2.4 + Math.random() * 3.6
            else blink = Math.sin(Math.PI * bp)
          }
        }
        const stretchH = narrow ? Math.min(1.35, pitchY / pitch || 1) : 1
        const swayX = Math.sin(t * 0.6 + 1.2) * 2.1 * idleK
        const breathY = Math.sin(t * 1.8) * 1.7 * idleK
        const artCx = anchorX + artW / 2

        // hover is active only over the artwork (portrait bbox + a little slack)
        const artH = pitchY * grid.rows
        const artY0 = anchorY - scrollY
        const inArt =
          ptr.on &&
          ptr.x > anchorX - 50 && ptr.x < anchorX + artW + 50 &&
          ptr.y > artY0 - 50 && ptr.y < artY0 + artH + 50
        const R = (narrow ? 100 : 116) * (coarse ? 1.25 : 1)

        // flight-layer crossfire: the rocket strafes the fleet while it flies
        // (see FlightCanvas) — impacts land as velocity impulses, and an
        // attacking rocket continuously shoves nearby ships off its path
        const kicks = fleetBus.drain()
        const rocket = fleetBus.rocket
        const rocketOn = rocket.attacking
        const rocketX = rocket.x
        const rocketY = rocket.y

        ctx.clearRect(0, 0, vw, vh)
        for (let si = 0; si < ships.length; si++) {
          const s = ships[si]
          // per-ship dissolve: the fleet lets go in a staggered cascade
          const raw = disp * 1.35 - s.stag * 0.35
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

          // projectile impacts: upheaval radiating from each hit
          for (const k of kicks) {
            const dxk = s.px - k.x
            const dyk = s.py - k.y
            const dk = Math.hypot(dxk, dyk)
            if (dk < k.r) {
              const f = 1 - dk / k.r
              const pow = k.hit * (0.35 + 0.65 * f)
              s.vx += (dxk / (dk || 1)) * pow
              s.vy += (dyk / (dk || 1)) * pow
            }
          }
          // an attacking rocket clears its own flight path
          if (rocketOn) {
            const dxr = s.px - rocketX
            const dyr = s.py - rocketY
            const dr = Math.hypot(dxr, dyr)
            if (dr < 120 && dr > 0.01) {
              const f = 1 - dr / 120
              tx += (dxr / dr) * f * 90
              ty += (dyr / dr) * f * 90
            }
          }

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

          // idle facial life: sway leads at the top rows (a head tilting),
          // breath leads at the bottom (a chest rising), eye cells blink —
          // shrink + pinch toward the eye-line centre
          if (idleK > 0.02 && sEff < 0.4) {
            tx += swayX * (0.45 + 0.55 * (1 - s.cyf))
            ty += breathY * (1 - s.cyf * 0.55)
            if (s.eye && blink > 0) tx += (artCx - tx) * 0.22 * blink
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
          // off-screen ships (scattered past the viewport on the stage) cost
          // nothing to skip
          if (s.px < -40 || s.px > vw + 40 || s.py < -40 || s.py > vh + 40) continue
          // scattered ships swell a little — the dispersal reads on every
          // screen size; the formed portrait keeps its exact mosaic size
          let size2 =
            pitch * (0.62 + 0.55 * s.w) * (s.band === 2 ? 0.75 + ((s.stag * 997) % 100) / 180 : 1) *
            (1 + 0.55 * sEff)
          let sizeH = size2 * stretchH
          if (narrow) {
            // feature prominence on the big portrait: the skin mass renders
            // large and dense, hat felt renders lighter, eye whites are holes
            // at full pitch, ink stays small + crisp (and draws last via the
            // assignHomes sort)
            if (s.band === 3) size2 *= 0.72
            else if (s.band === 4) size2 *= 1.05
            else if (s.band !== 2) size2 *= 1.42
          }
          if (s.eye && blink > 0 && sEff < 0.4) sizeH *= 1 - 0.75 * blink
          const rot = s.jr * (1 - sEff) + (s.spin + Math.sin(t * 0.35 + s.ph) * 0.55) * sEff
          ctx.globalAlpha = 1 - 0.12 * sEff
          if (sEff === 0 && s.jr !== 0) {
            // formed + jittered: the pre-baked rotation bucket
            const ji = Math.round(s.jr / 0.055) + 4
            const sprR = spritesRot[`${ji}|${s.v}${s.band}`]
            if (sprR) {
              ctx.drawImage(sprR, s.px - size2 / 2, s.py - sizeH / 2, size2, sizeH)
            } else {
              ctx.drawImage(spr, s.px - size2 / 2, s.py - sizeH / 2, size2, sizeH)
            }
          } else if (Math.abs(rot) < 0.02) {
            ctx.drawImage(spr, s.px - size2 / 2, s.py - sizeH / 2, size2, sizeH)
          } else {
            ctx.save()
            ctx.translate(s.px, s.py)
            ctx.rotate(rot)
            ctx.drawImage(spr, -size2 / 2, -sizeH / 2, size2, sizeH)
            ctx.restore()
          }
          // ping the flight layer (viewport space, hit radius = drawn size)
          const ping = fleetBus.ships[si]
          if (ping) {
            ping.x = s.px
            ping.y = s.py
            ping.s = size2
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
          fleetBus.ships = []
          window.removeEventListener('scroll', onScrollRm)
          themeObserver.disconnect()
        }
      }

      function drawStatic() {
        const sy = window.scrollY
        const stretchH = narrow ? Math.min(1.35, pitchY / pitch || 1) : 1
        ctx.clearRect(0, 0, vw, vh)
        for (const s of ships) {
          const spr = sprites[`${s.v}${s.band}`]
          if (!spr) continue
          let size2 = pitch * (0.62 + 0.55 * s.w) * (s.band === 2 ? 0.75 + ((s.stag * 997) % 100) / 180 : 1)
          let sizeH = size2 * stretchH
          if (narrow) {
            if (s.band === 3) size2 *= 0.72
            else if (s.band === 4) size2 *= 1.05
            else if (s.band !== 2) size2 *= 1.42
          }
          ctx.globalAlpha = 1
          ctx.save()
          ctx.translate(s.hx + ((s.stag * 8191) % 5) / 8 - 0.25, s.hy - sy + ((s.spin * 9973) % 5) / 8 - 0.25)
          ctx.rotate(s.jr)
          ctx.drawImage(spr, -size2 / 2, -sizeH / 2, size2, sizeH)
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
        fleetBus.ships = []
        fleetBus.drain()
        fleetBus.resetStage()
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
