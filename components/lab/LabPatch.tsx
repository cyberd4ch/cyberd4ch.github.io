'use client'

import { useEffect, useRef } from 'react'

/**
 * Lab telemetry, drawn as a SELA mission patch — the same visual language as
 * the flight canvas's story patches (pastel chip fills, ink linework, dashed
 * transfer orbits, a red mono kicker), but driven by the real snapshot.
 *
 * v2 keeps the patch CALM: the composition is static art — every pod, VM and
 * the forge sit at fixed, labeled slots — and exactly two things move: a
 * radar sweep riding the pod orbit (the only orbital motion, one speed) and
 * a slow breathing ring around the control-plane core. Nothing rotates at
 * competing speeds, no label ever chases a moving satellite.
 *
 * The patch scales with the panel width (geometry × s, clamped). Theme-aware
 * via CSS custom properties, re-read when the theme flips.
 * `prefers-reduced-motion` renders one honest static frame (sweep parked at
 * the top of the orbit); the rAF loop also parks while offscreen.
 */

type LabPatchProps = {
  /** kind cluster context, e.g. kind-lab02 — null when the probe missed */
  context: string | null
  /** k8s version, e.g. v1.37.0 */
  version: string | null
  podsUp: number
  podsTotal: number
  /** per-pod readiness in list order (dots sit on the orbit in this order) */
  podsReady: boolean[]
  restartsTotal: number
  forgeUp: boolean
  /** the two qemu vms — fixed labeled slots on the outer ring */
  vms: { name: string; up: boolean }[]
  /** control-plane node readiness */
  nodeReady: boolean
}

type Pal = {
  ink: string
  muted: string
  red: string
  blue: string
  chip: string
  card: string
}

const KICKER = '700 8px ui-monospace, SFMono-Regular, Menlo, monospace'
const LABEL = '700 9px ui-monospace, SFMono-Regular, Menlo, monospace'

/** the one motion: the sweep crosses the full orbit every SWEEP_S seconds */
const SWEEP_S = 14
/** the other motion: the core ring breathes every PULSE_S seconds */
const PULSE_S = 3.6

function readPal(host: HTMLElement): Pal {
  const cs = getComputedStyle(host)
  return {
    ink: cs.getPropertyValue('--fg').trim() || '#17171a',
    muted: cs.getPropertyValue('--muted').trim() || '#8a8a93',
    red: cs.getPropertyValue('--red').trim() || '#c4534d',
    blue: cs.getPropertyValue('--chip-blue').trim() || '#93d3e5',
    chip: cs.getPropertyValue('--chip-green').trim() || '#b9e4aa',
    card: cs.getPropertyValue('--card').trim() || '#fffdf8',
  }
}

export default function LabPatch(props: LabPatchProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!wrap || !canvas || !ctx) return
    const g = ctx

    const reduce =
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let pal = readPal(wrap)
    let raf = 0
    let running = false
    let w = 0
    let h = 0
    let dpr = 1
    const t0 = performance.now()

    // ---- geometry: scale with the panel width, clamp 0.72–1.12 ---------------
    function geo() {
      const s = Math.max(0.72, Math.min(1.12, w / 640))
      const cx = w / 2
      const cy = 112
      const rot = -0.26
      return {
        s,
        cx,
        cy,
        rot,
        coreR: 14 * s,
        orbitA: Math.min(w * 0.34, 225 * s),
        orbitB: 56 * s,
      }
    }
    type Geo = ReturnType<typeof geo>

    const orbitPoint = (gg: Geo, angle: number, a: number, b: number) => {
      const x0 = Math.cos(angle) * a
      const y0 = Math.sin(angle) * b
      const c = Math.cos(gg.rot)
      const sn = Math.sin(gg.rot)
      return { x: x0 * c - y0 * sn, y: x0 * sn + y0 * c }
    }

    // ---- palette flips with the theme ----------------------------------------
    const retheme = () => {
      pal = readPal(wrap)
      if (!running) draw(performance.now())
    }
    const themeObs = new MutationObserver(retheme)
    themeObs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme'],
    })

    const resize = () => {
      const rect = wrap.getBoundingClientRect()
      dpr = Math.min(2.5, window.devicePixelRatio || 1)
      w = Math.max(280, rect.width)
      h = 232
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width = '100%'
      canvas.style.height = `${h}px`
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (!running) draw(performance.now())
    }
    const sizeObs = new ResizeObserver(resize)
    sizeObs.observe(wrap)
    resize()

    // ---- one frame -------------------------------------------------------------
    function draw(now: number) {
      const t = (now - t0) / 1000
      const gg = geo()
      const { cx, cy, s } = gg
      const outerA = gg.orbitA + 20 * s
      const outerB = gg.orbitB + 13 * s
      g.clearRect(0, 0, w, h)
      g.save()
      g.lineJoin = 'round'
      g.lineCap = 'round'
      g.textAlign = 'center'

      // phase for the two motions (frozen under reduced motion)
      const sweepA = reduce ? -Math.PI / 2 : (t / SWEEP_S) * Math.PI * 2 - Math.PI / 2
      const pulse = reduce ? 0.5 : 0.5 + 0.5 * Math.sin((t / PULSE_S) * Math.PI * 2)

      // ---- kicker + summary label (SELA patch typography) ----------------------
      g.font = KICKER
      g.fillStyle = pal.red
      g.fillText('LAB TELEMETRY', cx, 22)
      g.font = LABEL
      g.fillStyle = pal.ink
      if (w < 560) {
        // narrow panels: the summary wraps to two lines above the floor
        g.fillText(`${props.context ?? 'no cluster'} · K8S ${props.version ?? '?'}`, cx, h - 21)
        g.fillText(
          `${props.podsUp}/${props.podsTotal} PODS · ${props.restartsTotal} RESTARTS · FORGE ${props.forgeUp ? 'UP' : 'DOWN'}`,
          cx,
          h - 10,
        )
      } else {
        g.fillText(
          `${props.context ?? 'no cluster'} · K8S ${props.version ?? '?'} · ${props.podsUp}/${props.podsTotal} PODS · ${props.restartsTotal} RESTARTS · FORGE ${props.forgeUp ? 'UP' : 'DOWN'}`,
          cx,
          h - 10,
        )
      }

      // ---- the pod orbit (dashed, like the flight patches) ----------------------
      g.strokeStyle = pal.muted
      g.lineWidth = 1.2
      g.beginPath()
      g.ellipse(cx, cy, gg.orbitA, gg.orbitB, gg.rot, 0, Math.PI * 2)
      g.setLineDash([4, 4])
      g.stroke()
      g.setLineDash([])

      // outer service ring: wider, fainter — carries vms + the forge, fixed
      if (props.vms.length) {
        g.globalAlpha = 0.5
        g.beginPath()
        g.ellipse(cx, cy, outerA, outerB, gg.rot, 0, Math.PI * 2)
        g.setLineDash([2, 5])
        g.stroke()
        g.setLineDash([])
        g.globalAlpha = 1
      }

      // ---- the control-plane core (the only breathing element) ------------------
      const coreFill = props.nodeReady ? pal.blue : pal.card
      g.lineWidth = 1.6
      g.strokeStyle = pal.ink
      g.beginPath()
      g.arc(cx, cy, gg.coreR, 0, Math.PI * 2)
      g.fillStyle = coreFill
      g.fill()
      g.stroke()
      g.globalAlpha = 0.22 + 0.3 * pulse
      if (props.nodeReady) {
        g.beginPath()
        g.arc(cx, cy, gg.coreR + 3 + 2.5 * pulse, 0, Math.PI * 2)
        g.stroke()
      } else {
        g.setLineDash([3, 3])
        g.beginPath()
        g.arc(cx, cy, gg.coreR + 3, 0, Math.PI * 2)
        g.stroke()
        g.setLineDash([])
      }
      g.globalAlpha = 1
      g.beginPath()
      g.arc(cx, cy, 3 * s, 0, Math.PI * 2)
      if (props.nodeReady) {
        g.fillStyle = pal.ink
        g.fill()
      } else {
        g.stroke()
      }

      // ---- restart dial: a STATIC tick ring around the core (a count, not a
      //      spinner) — one tick per capped restart, notched into the core ring
      const ticks = Math.min(12, props.restartsTotal)
      for (let i = 0; i < ticks; i++) {
        const a = (i / Math.max(1, ticks)) * Math.PI * 2 - Math.PI / 2
        const r0 = gg.coreR + 7 * s
        g.beginPath()
        g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0)
        g.lineTo(cx + Math.cos(a) * (r0 + 3 * s), cy + Math.sin(a) * (r0 + 3 * s))
        g.globalAlpha = 0.55
        g.stroke()
        g.globalAlpha = 1
      }

      // ---- pods: STATIC positions around the orbit, one dot each ---------------
      const n = props.podsReady.length
      const shown = Math.min(n, 14)
      for (let i = 0; i < shown; i++) {
        const angle = (i / Math.max(1, shown)) * Math.PI * 2 - Math.PI / 2
        const p = orbitPoint(gg, angle, gg.orbitA, gg.orbitB)
        const ready = props.podsReady[i]
        g.beginPath()
        g.arc(cx + p.x, cy + p.y, 3 * s, 0, Math.PI * 2)
        if (ready) {
          g.fillStyle = pal.chip
          g.fill()
          g.strokeStyle = pal.ink
          g.stroke()
        } else {
          g.fillStyle = pal.red
          g.fill()
          g.strokeStyle = pal.red
          g.stroke()
        }
      }
      if (n > shown) {
        // +N badge parked at the orbit's right vertex — static, haloed
        const p = orbitPoint(gg, 0, gg.orbitA, gg.orbitB)
        const text = `+${n - shown}`
        g.font = KICKER
        const tw = g.measureText(text).width
        g.fillStyle = pal.card
        g.fillRect(cx + p.x + 4 * s, cy + p.y - 4 * s, tw + 4, 11)
        g.fillStyle = pal.muted
        g.fillText(text, cx + p.x + 6 * s, cy + p.y + 3 * s)
      }

      // ---- the radar sweep: the ONE moving element ------------------------------
      // a short fading trail + head dot riding the pod orbit
      const TRAIL = 0.55 // radians of trail
      g.globalAlpha = 0.5
      g.strokeStyle = pal.red
      g.lineWidth = 2
      g.beginPath()
      g.ellipse(cx, cy, gg.orbitA, gg.orbitB, gg.rot, sweepA - TRAIL, sweepA)
      g.stroke()
      g.globalAlpha = 1
      const sp = orbitPoint(gg, sweepA, gg.orbitA, gg.orbitB)
      g.beginPath()
      g.arc(cx + sp.x, cy + sp.y, 2.4 * s, 0, Math.PI * 2)
      g.fillStyle = pal.red
      g.fill()

      // ---- outer-ring slots: vms + forge, FIXED positions, labels beside -------
      // slots: vm0 at upper-right of the ring, vm1 at upper-left, forge at the
      // bottom vertex — labels sit statically beside each glyph.
      const slots = props.vms.map((vm, i) => {
        const angle = i === 0 ? -0.45 : Math.PI + 0.45
        return { angle, vm }
      })
      for (const { angle, vm } of slots) {
        const p = orbitPoint(gg, angle, outerA, outerB)
        g.beginPath()
        g.arc(cx + p.x, cy + p.y, 2.6 * s, 0, Math.PI * 2)
        if (vm.up) {
          g.fillStyle = pal.blue
          g.fill()
          g.strokeStyle = pal.ink
          g.stroke()
        } else {
          g.strokeStyle = pal.muted
          g.stroke()
        }
        // label: horizontal, offset away from the ellipse center, haloed so it
        // stays legible over the ring dashes
        const side = p.x >= 0 ? 1 : -1
        g.font = KICKER
        const name = vm.name.toUpperCase()
        const tw = g.measureText(name).width
        g.fillStyle = pal.card
        g.globalAlpha = 0.85
        g.fillRect(
          cx + p.x + (side > 0 ? 4 * s : -4 * s - tw),
          cy + p.y - 4,
          tw + 3,
          11,
        )
        g.globalAlpha = 1
        g.fillStyle = pal.muted
        g.textAlign = side > 0 ? 'left' : 'right'
        g.fillText(name, cx + p.x + side * 8 * s, cy + p.y + 3)
        g.textAlign = 'center'
      }

      // ---- the forge: the ground station, hanging BELOW the ring's bottom
      //      vertex on a short rule — part of the composition, not floating ------
      const fa = Math.PI / 2
      const fp = orbitPoint(gg, fa, outerA, outerB)
      const ringY = cy + fp.y
      const fx = cx + fp.x
      const fy = Math.min(ringY + 13 * s, h - 26) // dish center; stays clear of the summary
      // downlink rule from the ring down to the mast
      g.strokeStyle = props.forgeUp ? pal.muted : pal.muted
      g.globalAlpha = props.forgeUp ? 0.9 : 0.5
      g.lineWidth = 1.2
      g.setLineDash(props.forgeUp ? [] : [2, 3])
      g.beginPath()
      g.moveTo(fx, ringY)
      g.lineTo(fx, fy - 5 * s)
      g.stroke()
      g.setLineDash([])
      g.globalAlpha = 1
      // mast + legs
      g.strokeStyle = props.forgeUp ? pal.ink : pal.muted
      g.lineWidth = 1.6
      g.beginPath()
      g.moveTo(fx, fy - 5 * s)
      g.lineTo(fx, fy + 4 * s)
      g.moveTo(fx - 3.5 * s, fy + 4 * s)
      g.lineTo(fx + 3.5 * s, fy + 4 * s)
      g.moveTo(fx, fy + 4 * s)
      g.lineTo(fx - 2.5 * s, fy + 7 * s)
      g.moveTo(fx, fy + 4 * s)
      g.lineTo(fx + 2.5 * s, fy + 7 * s)
      g.stroke()
      // the beacon: the live signal, breathing with the SAME phase as the core
      g.beginPath()
      g.arc(fx, fy - 5 * s, 2.2 * s, 0, Math.PI * 2)
      if (props.forgeUp) {
        g.fillStyle = pal.chip
        g.fill()
        g.strokeStyle = pal.ink
        g.stroke()
        g.globalAlpha = 0.2 + 0.35 * pulse
        g.beginPath()
        g.arc(fx, fy - 5 * s, (5 + 2 * pulse) * s, 0, Math.PI * 2)
        g.strokeStyle = pal.chip
        g.stroke()
        g.globalAlpha = 1
      } else {
        g.strokeStyle = pal.muted
        g.stroke()
      }
      g.font = KICKER
      g.fillStyle = pal.muted
      g.textAlign = 'left'
      g.fillText('FORGE', fx + 9 * s, fy + 3)
      g.textAlign = 'center'

      g.restore()
    }

    // ---- loop control -----------------------------------------------------------
    const frame = (now: number) => {
      draw(now)
      raf = requestAnimationFrame(frame)
    }
    const start = () => {
      if (running || reduce) return
      running = true
      raf = requestAnimationFrame(frame)
    }
    const stop = () => {
      running = false
      cancelAnimationFrame(raf)
    }

    // park the loop while offscreen; reduced motion gets a single drawn frame
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) start()
      else stop()
    })
    io.observe(wrap)
    if (reduce) draw(performance.now())
    else start()

    return () => {
      stop()
      io.disconnect()
      sizeObs.disconnect()
      themeObs.disconnect()
    }
  }, [props])

  return (
    <div ref={wrapRef} className="hud-panel lab-patch p-2" aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  )
}
