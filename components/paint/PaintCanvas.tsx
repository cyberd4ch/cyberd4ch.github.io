'use client'

import { useEffect, useRef } from 'react'
import type * as ThreeTypes from 'three'

/**
 * The paint snake — a giant red painted line that lives behind the page.
 *
 * Orthographic screen-space camera (1 world unit = 1 CSS px) and a single
 * TubeGeometry along a page-length CatmullRom curve. The curve slithers down
 * the blueprint margins outside the opaque paper column, sweeps across the
 * hero's upper whitespace on the home page, and flicks across the seam above
 * the footer.
 *
 * - Painted look: MeshPhysicalMaterial + PMREM RoomEnvironment (clearcoat
 *   sheen), toneMapped:false so #FC3D21 stays exactly NASA worm red.
 * - Slither: wind-sway displaced in the vertex shader via onBeforeCompile;
 *   the same formula runs in JS for the brush-tip sphere so the head stays
 *   welded to the line.
 * - Reveal: uv.x alpha cutoff driven by a uniform — the head advances with
 *   scroll plus a slow idle growth; the painted path persists (monotonic).
 * - Fallbacks: reduced motion / no WebGL / context loss -> data-paint="off",
 *   which shows the static SVG squiggle in the hero (globals.css).
 */

const RED = 0xfc3d21

function webglAvailable(): boolean {
  try {
    const probe = document.createElement('canvas')
    return Boolean(probe.getContext('webgl2') || probe.getContext('webgl'))
  } catch {
    return false
  }
}

export default function PaintCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const root = document.documentElement
    const canvas = canvasRef.current
    if (!canvas) return

    const bail = () => {
      root.dataset.paint = 'off'
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      bail()
      return
    }
    if (!webglAvailable()) {
      bail()
      return
    }

    let disposed = false
    let teardown: (() => void) | null = null

    void (async () => {
      try {
        const THREE = await import('three')
        const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js')
        if (disposed) return
        const down = initPaint(THREE, RoomEnvironment, canvas, bail)
        if (disposed) down()
        else teardown = down
      } catch {
        bail()
      }
    })()

    return () => {
      disposed = true
      teardown?.()
    }
  }, [])

  return <canvas ref={canvasRef} className="paint-canvas" aria-hidden="true" />
}

type ThreeNS = typeof import('three')

function initPaint(
  THREE: ThreeNS,
  RoomEnvironment: (typeof import('three/addons/environments/RoomEnvironment.js'))['RoomEnvironment'],
  canvas: HTMLCanvasElement,
  bail: () => void,
): () => void {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setClearColor(0x000000, 0)

  const scene = new THREE.Scene()
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 400)
  camera.position.z = 60

  // studio IBL for the painted-metal sheen
  const pmrem = new THREE.PMREMGenerator(renderer)
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environment = envTex

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.4)
  keyLight.position.set(-240, 380, 420)
  scene.add(keyLight)

  // ---- paint material: shared uniforms, injected slither + reveal ----------
  const uniforms = {
    uTime: { value: 0 },
    uHead: { value: 0 },
    uAmp: { value: 3.2 },
  }

  const makePaintMaterial = () => {
    const mat = new THREE.MeshPhysicalMaterial({
      color: RED,
      roughness: 0.38,
      metalness: 0.0,
      clearcoat: 0.55,
      clearcoatRoughness: 0.3,
      envMapIntensity: 0.85,
      transparent: true,
    })
    mat.toneMapped = false
    mat.onBeforeCompile = shader => {
      shader.uniforms.uTime = uniforms.uTime
      shader.uniforms.uHead = uniforms.uHead
      shader.uniforms.uAmp = uniforms.uAmp
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          '#include <common>\nuniform float uTime;\nuniform float uAmp;\nvarying float vPaint;'
        )
        .replace(
          '#include <begin_vertex>',
          [
            '#include <begin_vertex>',
            'vPaint = uv.x;',
            'transformed.xy += vec2(sin(vPaint * 70.0 - uTime * 1.5), sin(vPaint * 41.0 + uTime * 1.05)) * uAmp;',
          ].join('\n')
        )
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          '#include <common>\nuniform float uHead;\nvarying float vPaint;'
        )
        .replace(
          '#include <color_fragment>',
          [
            '#include <color_fragment>',
            '{',
            '  float edge = uHead - vPaint;',
            '  if (edge < 0.0) discard;',
            '  diffuseColor.a *= smoothstep(0.0, 0.005, edge);',
            '  diffuseColor.rgb *= 0.93 + 0.07 * sin(vPaint * 640.0);',
            '}',
          ].join('\n')
        )
    }
    return mat
  }

  const paintMat = makePaintMaterial()
  // brush tip: same paint, but no reveal cutoff of its own
  const headMat = new THREE.MeshPhysicalMaterial({
    color: RED,
    roughness: 0.38,
    metalness: 0.0,
    clearcoat: 0.55,
    clearcoatRoughness: 0.3,
    envMapIntensity: 0.85,
  })
  headMat.toneMapped = false

  // ---- geometry -------------------------------------------------------------
  const group = new THREE.Group()
  scene.add(group)
  let tube: ThreeTypes.Mesh | null = null
  let head: ThreeTypes.Mesh | null = null
  let curve: ThreeTypes.CatmullRomCurve3 | null = null
  let amp = 3.2
  let viewportH = window.innerHeight

  const rebuild = () => {
    const w = window.innerWidth
    const h = window.innerHeight
    const narrow = w < 760
    viewportH = h
    const docH = Math.max(
      document.documentElement.scrollHeight,
      document.body?.scrollHeight ?? 0,
      h
    )
    const radius = narrow ? 6.5 : 8
    amp = narrow ? 2 : 3.2
    uniforms.uAmp.value = amp
    const opacity = narrow ? 0.85 : 1
    paintMat.opacity = opacity
    headMat.opacity = opacity

    // measure the hero (sweep) and the footer (tail flick) in document space
    const heroEl = document.querySelector('.hero') as HTMLElement | null
    const footEl = document.querySelector('footer') as HTMLElement | null
    const heroTop = heroEl ? heroEl.getBoundingClientRect().top + window.scrollY : 0
    const heroH = heroEl ? heroEl.offsetHeight : 0
    const footTop = footEl ? footEl.getBoundingClientRect().top + window.scrollY : docH

    const outer = w / 2 - radius - 6
    const inner = narrow ? outer - 9 : 340 + 34
    // gutter envelope, needed here so the sweep can land exactly on the
    // gutter's first position (no kink at the join)
    const envAt = (y: number) =>
      inner + (outer - inner) * (0.5 + 0.5 * Math.sin(y / 210 + 1.3))
    const pts: ThreeTypes.Vector3[] = []
    const push = (x: number, y: number) => pts.push(new THREE.Vector3(x, -y, 0))

    if (heroH > 220 && heroTop < 200) {
      // grand S-sweep across the hero's upper whitespace: dives from the top
      // left, bottoms out right of centre, lifts and exits into the right gutter
      const gutterStartY = heroTop + (narrow ? 180 : 300)
      if (narrow) {
        push(0, heroTop + 26)
        push(outer * 0.35, heroTop + 70)
        push(outer * 0.8, heroTop + 120)
        push(envAt(gutterStartY), gutterStartY - 12)
      } else {
        push(-outer + 10, heroTop + 10)
        push(-outer * 0.5, heroTop + 60)
        push(-outer * 0.05, heroTop + 190)
        push(outer * 0.45, heroTop + 262)
        push(envAt(gutterStartY), gutterStartY - 40)
      }
    } else {
      push(outer - 6, 8)
    }

    // gutter slither: one continuous sine crossing centre every 1150px —
    // hidden behind the paper column except at full-bleed bands, where the
    // crossing reads as a deliberate sweep. Starts on the right (+1) so it
    // continues out of the hero sweep.
    const startY = heroH > 220 && heroTop < 200 ? heroTop + (narrow ? 180 : 300) : 20
    const endY = Math.min(docH - 8, Math.max(footTop - 170, startY + 60))
    const period = 1150
    for (let y = startY; y <= endY; y += 26) {
      const side = Math.cos((Math.PI * (y - startY)) / period)
      const env = inner + (outer - inner) * (0.5 + 0.5 * Math.sin(y / 210 + 1.3))
      push(side * env, y)
    }

    // tail: lift-off — the brush exits through the margin just above the
    // footer, staying on the side it arrived on (no crossing behind paper)
    const lastX = pts.length ? pts[pts.length - 1].x : outer
    if (footTop > startY + 400) {
      const s = Math.sign(lastX) || 1
      const exitX = s * Math.max(Math.abs(lastX), inner)
      push(exitX * 0.92, footTop - 56)
      push(s * (outer + 10), footTop - 24)
      push(s * (outer + 10), footTop - 6)
    } else {
      push(lastX, docH - 10)
    }

    curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal')
    const geo = new THREE.TubeGeometry(curve, Math.min(pts.length * 3, 2200), radius, 12, false)
    if (tube) {
      tube.geometry.dispose()
      tube.geometry = geo
    } else {
      tube = new THREE.Mesh(geo, paintMat)
      group.add(tube)
    }
    const headGeo = new THREE.SphereGeometry(radius * 1.5, 24, 16)
    if (head) {
      head.geometry.dispose()
      head.geometry = headGeo
    } else {
      head = new THREE.Mesh(headGeo, headMat)
      group.add(head)
    }
  }

  // ---- camera framing --------------------------------------------------------
  const applyViewport = () => {
    const w = window.innerWidth
    const h = window.innerHeight
    camera.left = -w / 2
    camera.right = w / 2
    camera.top = h / 2
    camera.bottom = -h / 2
    camera.updateProjectionMatrix()
    renderer.setSize(w, h, false)
  }
  applyViewport()
  rebuild()

  // ---- lifecycle -------------------------------------------------------------
  let raf = 0
  let running = !document.hidden
  let dead = false
  let tearingDown = false

  const onVisibility = () => {
    running = !document.hidden
    if (running && !dead) {
      clock.getDelta()
      raf = requestAnimationFrame(frame)
    } else {
      cancelAnimationFrame(raf)
    }
  }
  document.addEventListener('visibilitychange', onVisibility)

  const onContextLost = (e: Event) => {
    e.preventDefault()
    if (tearingDown) return
    dead = true
    cancelAnimationFrame(raf)
    bail()
  }
  canvas.addEventListener('webglcontextlost', onContextLost)

  // ---- animation loop ----------------------------------------------------------
  const clock = new THREE.Clock()
  let t = 0
  let headU = 0
  let idleHead = 0
  let camY = -(window.scrollY + viewportH / 2)

  const frame = () => {
    raf = requestAnimationFrame(frame)
    if (dead) return
    const dt = Math.min(clock.getDelta(), 0.05)
    t += dt
    uniforms.uTime.value = t

    // reveal head: scroll-driven, slow idle growth, painted path persists
    const docH = Math.max(document.documentElement.scrollHeight, viewportH)
    const scrollFrac = docH > viewportH ? window.scrollY / (docH - viewportH) : 0
    idleHead = Math.max(idleHead + dt * 0.02, headU)
    const target = Math.min(1.04, Math.max(idleHead, scrollFrac * 1.02))
    headU += (target - headU) * Math.min(1, dt * 2.8)
    uniforms.uHead.value = headU

    // brush tip rides the curve + the same slither the shader applies
    if (head && curve) {
      const u = THREE.MathUtils.clamp(headU, 0, 1)
      const p = curve.getPointAt(u)
      const swx = Math.sin(u * 70 - t * 1.5) * amp
      const swy = Math.sin(u * 41 + t * 1.05) * amp
      head.position.set(p.x + swx, p.y + swy, 0)
      head.scale.setScalar(1 + 0.07 * Math.sin(t * 2.6))
    }

    // camera tracks scroll (eased) — world y is inverted document space
    const targetCamY = -(window.scrollY + viewportH / 2)
    camY += (targetCamY - camY) * Math.min(1, dt * 7)
    camera.position.y = camY

    renderer.render(scene, camera)
  }

  renderer.render(scene, camera)
  document.documentElement.dataset.paint = 'on'
  raf = requestAnimationFrame(frame)

  // ---- resize / content-height rebuilds ----------------------------------------
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
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        applyViewport()
        rebuild()
      }
    }, 180)
  }
  window.addEventListener('resize', scheduleRebuild)
  const bodyObserver = new ResizeObserver(scheduleRebuild)
  bodyObserver.observe(document.body)
  if (document.fonts) document.fonts.ready.then(scheduleRebuild).catch(() => {})

  // ---- disposal ------------------------------------------------------------------
  return () => {
    tearingDown = true
    dead = true
    cancelAnimationFrame(raf)
    window.removeEventListener('resize', scheduleRebuild)
    document.removeEventListener('visibilitychange', onVisibility)
    canvas.removeEventListener('webglcontextlost', onContextLost)
    bodyObserver.disconnect()
    window.clearTimeout(rebuildTimer)
    tube?.geometry.dispose()
    head?.geometry.dispose()
    paintMat.dispose()
    headMat.dispose()
    envTex.dispose()
    pmrem.dispose()
    renderer.dispose()
  }
}
