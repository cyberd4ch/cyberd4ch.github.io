'use client'

import { useEffect, useRef } from 'react'

/**
 * Lab telemetry, drawn as a SELA mission patch — the same visual language as
 * the flight canvas's story patches (pastel chip fills, ink linework, dashed
 * transfer orbits, a red mono kicker), but animated and driven by the real
 * snapshot: one dot per pod riding the orbit, restart ticks around the core,
 * the forge's downlink rule, and a VM satellite on the outer ring. The art IS
 * the readout; the mono label under it carries the numbers again for a11y.
 *
 * Theme-aware: palettes resolve from CSS custom properties, re-read when the
 * document's theme class flips. `prefers-reduced-motion` renders one static
 * frame; the rAF loop also parks while the patch is offscreen.
 */

type LabPatchProps = {
  /** kind cluster context, e.g. kind-lab02 — null when the probe missed */
  context: string | null
  /** k8s version, e.g. v1.37.0 */
  version: string | null
  podsUp: number
  podsTotal: number
  /** per-pod readiness in list order (the dots ride the orbit in this order) */
  podsReady: boolean[]
  restartsTotal: number
  forgeUp: boolean
  /** the two qemu vms — satellites on the outer orbit */
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

/** orbit geometry in patch units (the patch draws in a 150×110 box, centered) */
const CORE_R = 15
const ORBIT_A = 56
const ORBIT_B = 21
const ORBIT_ROT = -0.42
const OUTER_A = 66

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

    const orbitPoint = (angle: number, a: number, b: number) => {
      const x0 = Math.cos(angle) * a
      const y0 = Math.sin(angle) * b
      const c = Math.cos(ORBIT_ROT)
      const s = Math.sin(ORBIT_ROT)
      return { x: x0 * c - y0 * s, y: x0 * s + y0 * c }
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
      h = 210
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
      const cx = w / 2
      const cy = h / 2 + 6
      g.clearRect(0, 0, w, h)
      g.save()
      g.lineJoin = 'round'
      g.lineCap = 'round'
      g.textAlign = 'center'

      const pulse = reduce ? 0.5 : 0.5 + 0.5 * Math.sin(t * 1.5)

      // ---- kicker + label (SELA patch typography) ------------------------------
      g.font = KICKER
      g.fillStyle = pal.red
      g.fillText('LAB TELEMETRY', cx, 26)
      g.font = LABEL
      g.fillStyle = pal.ink
      g.fillText(
        `${props.context ?? 'no cluster'} · K8S ${props.version ?? '?'} · ${props.podsUp}/${props.podsTotal} PODS · FORGE ${props.forgeUp ? 'UP' : 'DOWN'}`,
        cx,
        h - 16,
      )

      // ---- the transfer orbit (dashed, like the flight patches) ----------------
      g.strokeStyle = pal.muted
      g.lineWidth = 1.2
      g.beginPath()
      g.ellipse(cx, cy, ORBIT_A, ORBIT_B, ORBIT_ROT, 0, Math.PI * 2)
      g.setLineDash([4, 4])
      g.stroke()
      g.setLineDash([])

      // outer VM orbit: wider, fainter, only when vms exist
      if (props.vms.length) {
        g.globalAlpha = 0.55
        g.beginPath()
        g.ellipse(cx, cy, OUTER_A, ORBIT_B + 9, ORBIT_ROT, 0, Math.PI * 2)
        g.setLineDash([2, 5])
        g.stroke()
        g.setLineDash([])
        g.globalAlpha = 1
      }

      // ---- the control-plane core ----------------------------------------------
      const coreFill = props.nodeReady ? pal.blue : pal.card
      g.lineWidth = 1.6
      g.strokeStyle = pal.ink
      g.beginPath()
      g.arc(cx, cy, CORE_R, 0, Math.PI * 2)
      g.fillStyle = coreFill
      g.fill()
      g.stroke()
      // readiness pulse: a breathing inner ring (solid core, dashed when not ready)
      g.globalAlpha = 0.35 + 0.4 * pulse
      if (props.nodeReady) {
        g.beginPath()
        g.arc(cx, cy, CORE_R + 4 + 2 * pulse, 0, Math.PI * 2)
        g.stroke()
      } else {
        g.setLineDash([3, 3])
        g.beginPath()
        g.arc(cx, cy, CORE_R + 4, 0, Math.PI * 2)
        g.stroke()
        g.setLineDash([])
      }
      g.globalAlpha = 1
      // node glyph: a small solid dot at the center (ready) / hollow (not)
      g.beginPath()
      g.arc(cx, cy, 3.2, 0, Math.PI * 2)
      if (props.nodeReady) {
        g.fillStyle = pal.ink
        g.fill()
      } else {
        g.stroke()
      }

      // ---- restart ticks around the core ---------------------------------------
      const ticks = Math.min(10, props.restartsTotal)
      for (let i = 0; i < ticks; i++) {
        const a = (i / Math.max(1, ticks)) * Math.PI * 2 + t * 0.12
        const r0 = CORE_R + 8
        g.beginPath()
        g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0)
        g.lineTo(cx + Math.cos(a) * (r0 + 3), cy + Math.sin(a) * (r0 + 3))
        g.globalAlpha = 0.6
        g.stroke()
        g.globalAlpha = 1
      }

      // ---- pod dots riding the orbit --------------------------------------------
      const n = props.podsReady.length
      const shown = Math.min(n, 14)
      for (let i = 0; i < shown; i++) {
        const angle = (i / Math.max(1, shown)) * Math.PI * 2 + t * 0.5
        const p = orbitPoint(angle, ORBIT_A, ORBIT_B)
        const ready = props.podsReady[i]
        g.beginPath()
        g.arc(cx + p.x, cy + p.y, 3, 0, Math.PI * 2)
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
        // the +N badge rides the orbit's leading edge, haloed in card color so
        // it stays legible over dots and dashes
        const p = orbitPoint(t * 0.5, ORBIT_A, ORBIT_B)
        const text = `+${n - shown}`
        g.font = KICKER
        const tw = g.measureText(text).width
        g.fillStyle = pal.card
        g.fillRect(cx + p.x + 4, cy + p.y - 4, tw + 4, 11)
        g.fillStyle = pal.muted
        g.fillText(text, cx + p.x + 6, cy + p.y + 3)
      }

      // ---- vm satellites on the outer ring --------------------------------------
      props.vms.forEach((vm, i) => {
        const angle = (i / Math.max(1, props.vms.length)) * Math.PI * 2 - t * 0.3
        const p = orbitPoint(angle, OUTER_A, ORBIT_B + 9)
        g.beginPath()
        g.arc(cx + p.x, cy + p.y, 2.6, 0, Math.PI * 2)
        if (vm.up) {
          g.fillStyle = pal.blue
          g.fill()
          g.strokeStyle = pal.ink
          g.stroke()
        } else {
          g.strokeStyle = pal.muted
          g.stroke()
        }
        // the label sits radially outward of the satellite — never over the
        // core or the pod orbit, whatever the satellite's phase
        const len = Math.hypot(p.x, p.y) || 1
        g.font = KICKER
        g.fillStyle = pal.muted
        g.fillText(
          vm.name.toUpperCase(),
          cx + p.x + (p.x / len) * 14,
          cy + p.y + (p.y / len) * 14 + 3,
        )
      })

      // ---- the forge downlink ----------------------------------------------------
      // a dotted plumb line from the patch floor to a small dish; up = live
      // pulse traveling down it, down = dashed and hollow
      const fx = cx + ORBIT_A + 22
      const fy0 = cy - 26
      const fy1 = cy + 30
      g.strokeStyle = pal.muted
      g.lineWidth = 1.2
      g.setLineDash(props.forgeUp ? [1.5, 4] : [2, 5])
      g.beginPath()
      g.moveTo(fx, fy0)
      g.lineTo(fx, fy1)
      g.stroke()
      g.setLineDash([])
      // dish glyph
      g.strokeStyle = pal.ink
      g.lineWidth = 1.6
      g.beginPath()
      g.arc(fx, fy1, 6, Math.PI * 1.15, Math.PI * 1.85)
      g.stroke()
      g.beginPath()
      g.moveTo(fx, fy1)
      g.lineTo(fx, fy1 + 6)
      g.stroke()
      if (props.forgeUp) {
        // the pulse: a dot traveling the rule, looping ~3s
        const k = reduce ? 0.5 : (t % 3) / 3
        g.beginPath()
        g.arc(fx, fy0 + (fy1 - fy0) * k, 2.2, 0, Math.PI * 2)
        g.fillStyle = pal.red
        g.fill()
      }

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
