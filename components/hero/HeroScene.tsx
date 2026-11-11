'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'

/**
 * Mission-control hero: the Orbit-d mark rebuilt from Three primitives,
 * drifting through a starfield, with a mission-red satellite in orbit.
 *
 * Ownership (single owner, per app-director): this component owns the renderer,
 * scene, camera, RAF loop, resize, visibility, theme, and all disposal.
 *
 * Geometry is lifted 1:1 from public/brand/2026/mark.svg (viewBox 0 0 256 256),
 * mapped to y-up world coords via (x - 128, 135 - y) so the SVG center of the
 * orbit (128,135) lands on the origin:
 *   - bowl   circle r=44  -> torus r=44, tube=10 (stroke 20)
 *   - ring   arc r=84     -> torus r=84, tube=10, arc 290°, rotated to 93.4°
 *            (the SVG arc runs from 23.4° to 93.4° the long way; y-flip makes
 *             it a CCW sweep starting at 93.4°, gap open at one o'clock)
 *   - mast   x=172 y 27..179 -> box 20×152 at (44, 32), depth 24 so it reads
 *            as passing in front of ring and bowl (no coplanar z-fighting)
 *   - satellite  (dropped from the 2D mark on purpose) lives here: a red
 *            sphere riding an orbit just in front of the ring, born in the gap
 */

const INK_LIGHT = 0x0f0e0d
const INK_DARK = 0xf7f6f3
const STAR_LIGHT = 0x7a7470
const STAR_DARK = 0xf7f6f3
const MISSION_RED = 0xfc3d21

const DEG = THREE.MathUtils.degToRad
/** orbit radius of the satellite = ring radius; lifted forward to clear the tube */
const ORBIT_R = 84
const ORBIT_Z = 26

function webglAvailable(): boolean {
  try {
    const probe = document.createElement('canvas')
    return Boolean(probe.getContext('webgl2') || probe.getContext('webgl'))
  } catch {
    return false
  }
}

function makeStarField(count: number, xSpread: number, ySpread: number, zNear: number, zFar: number): THREE.BufferGeometry {
  const positions = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 2 * xSpread
    positions[i * 3 + 1] = (Math.random() - 0.5) * 2 * ySpread
    positions[i * 3 + 2] = zNear + Math.random() * (zFar - zNear)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  return geo
}

export default function HeroScene({ onReady, onFail }: { onReady?: () => void; onFail?: () => void }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const cbRef = useRef({ onReady, onFail })
  cbRef.current = { onReady, onFail }

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    if (!webglAvailable()) {
      cbRef.current.onFail?.()
      return
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.domElement.className = 'block h-full w-full'
    renderer.domElement.setAttribute('aria-hidden', 'true')
    host.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(35, 1, 1, 2200)

    // ---- the mark ----------------------------------------------------------
    const inkMat = new THREE.MeshBasicMaterial({ color: INK_LIGHT })
    const redMat = new THREE.MeshBasicMaterial({ color: MISSION_RED })

    const mark = new THREE.Group()
    mark.position.y = 28 // lift so the lower third stays clear for the DOM title

    const ringGeo = new THREE.TorusGeometry(ORBIT_R, 10, 20, 140, DEG(290))
    const ring = new THREE.Mesh(ringGeo, inkMat)
    ring.rotation.z = DEG(93.4)

    const bowlGeo = new THREE.TorusGeometry(44, 10, 20, 96)
    const bowl = new THREE.Mesh(bowlGeo, inkMat)

    const mastGeo = new THREE.BoxGeometry(20, 152, 24)
    const mast = new THREE.Mesh(mastGeo, inkMat)
    mast.position.set(44, 32, 0)

    const satGeo = new THREE.SphereGeometry(11, 32, 24)
    const sat = new THREE.Mesh(satGeo, redMat)

    mark.add(ring, bowl, mast, sat)
    scene.add(mark)

    // ---- starfield (two depths, counter-drifting behind the mark) ----------
    const starMatNear = new THREE.PointsMaterial({
      color: STAR_LIGHT, size: 2.4, transparent: true, opacity: 0.5, sizeAttenuation: true, depthWrite: false,
    })
    const starMatFar = new THREE.PointsMaterial({
      color: STAR_LIGHT, size: 1.5, transparent: true, opacity: 0.24, sizeAttenuation: true, depthWrite: false,
    })
    const starGroup = new THREE.Group()
    const starsNear = new THREE.Points(makeStarField(1150, 1100, 640, -180, -520), starMatNear)
    const starsFar = new THREE.Points(makeStarField(350, 1300, 760, -420, -820), starMatFar)
    starGroup.add(starsNear, starsFar)
    scene.add(starGroup)

    // ---- theme (follows the site's .dark toggle) ---------------------------
    const applyTheme = () => {
      const dark = document.documentElement.classList.contains('dark')
      inkMat.color.setHex(dark ? INK_DARK : INK_LIGHT)
      starMatNear.color.setHex(dark ? STAR_DARK : STAR_LIGHT)
      starMatFar.color.setHex(dark ? STAR_DARK : STAR_LIGHT)
    }
    applyTheme()
    const themeObserver = new MutationObserver(applyTheme)
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

    // ---- resize / framing ---------------------------------------------------
    // Fit the whole mark with margin, pulling the camera back on narrow screens.
    // Wide screens: slide the mark to the right so the left-aligned copy owns
    // the left half (portrait: mark raised, copy sits below-center via CSS).
    const fit = () => {
      const w = host.clientWidth || 1
      const h = host.clientHeight || 1
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      const tanHalf = Math.tan(DEG(17.5))
      const distHeight = 150 / tanHalf
      const distWidth = 104 / (tanHalf * camera.aspect)
      camera.position.z = Math.max(distHeight, distWidth)
      camera.updateProjectionMatrix()

      const halfWidth = tanHalf * camera.position.z * camera.aspect
      if (camera.aspect >= 1.25) {
        mark.position.x = halfWidth - 140
        mark.position.y = 28
      } else if (camera.aspect < 0.9) {
        mark.position.x = 0
        mark.position.y = 40
      } else {
        mark.position.x = 0
        mark.position.y = 28
      }
    }
    fit()
    const resizeObserver = new ResizeObserver(fit)
    resizeObserver.observe(host)

    // ---- lifecycle flags ----------------------------------------------------
    let raf = 0
    let disposed = false
    let running = !document.hidden
    let inView = true

    const onVisibility = () => { running = !document.hidden }
    document.addEventListener('visibilitychange', onVisibility)

    const intersection = new IntersectionObserver(entries => {
      inView = entries[0]?.isIntersecting ?? true
    })
    intersection.observe(host)

    // ---- mouse parallax -----------------------------------------------------
    const target = { rx: 0, ry: 0 }
    const eased = { rx: 0, ry: 0 }
    const onMouseMove = (e: MouseEvent) => {
      target.ry = ((e.clientX / window.innerWidth) * 2 - 1) * 0.16
      target.rx = -(((e.clientY / window.innerHeight) * 2 - 1) * 0.12)
    }
    window.addEventListener('mousemove', onMouseMove, { passive: true })

    // ---- context loss -> static fallback ------------------------------------
    const onContextLost = (e: Event) => {
      e.preventDefault()
      disposed = true
      cancelAnimationFrame(raf)
      cbRef.current.onFail?.()
    }
    renderer.domElement.addEventListener('webglcontextlost', onContextLost, false)

    // ---- animation ----------------------------------------------------------
    const clock = new THREE.Clock()
    let satAngle = DEG(60) // born inside the one o'clock gap

    const advance = (dt: number) => {
      satAngle += 0.3 * dt
      sat.position.set(Math.cos(satAngle) * ORBIT_R, Math.sin(satAngle) * ORBIT_R, ORBIT_Z)

      eased.rx += (target.rx - eased.rx) * 0.06
      eased.ry += (target.ry - eased.ry) * 0.06
      mark.rotation.x = eased.rx
      mark.rotation.y = eased.ry

      starGroup.rotation.z -= 0.0045 * dt
      starGroup.position.x = -eased.ry * 30
      starGroup.position.y = -eased.rx * 30
    }

    renderer.render(scene, camera)
    cbRef.current.onReady?.()

    if (reduced) {
      // One honest static frame; no loop, no listeners beyond theme/resize.
      return () => {
        cancelAnimationFrame(raf)
        document.removeEventListener('visibilitychange', onVisibility)
        window.removeEventListener('mousemove', onMouseMove)
        renderer.domElement.removeEventListener('webglcontextlost', onContextLost)
        themeObserver.disconnect()
        intersection.disconnect()
        resizeObserver.disconnect()
        ringGeo.dispose(); bowlGeo.dispose(); mastGeo.dispose(); satGeo.dispose()
        starsNear.geometry.dispose(); starsFar.geometry.dispose()
        inkMat.dispose(); redMat.dispose(); starMatNear.dispose(); starMatFar.dispose()
        renderer.dispose()
        renderer.domElement.remove()
      }
    }

    const frame = () => {
      raf = requestAnimationFrame(frame)
      if (disposed || !running || !inView) return
      const dt = Math.min(clock.getDelta(), 0.05)
      advance(dt)
      renderer.render(scene, camera)
    }
    frame()

    // ---- disposal -----------------------------------------------------------
    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('mousemove', onMouseMove)
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost)
      themeObserver.disconnect()
      intersection.disconnect()
      resizeObserver.disconnect()
      ringGeo.dispose(); bowlGeo.dispose(); mastGeo.dispose(); satGeo.dispose()
      starsNear.geometry.dispose(); starsFar.geometry.dispose()
      inkMat.dispose(); redMat.dispose(); starMatNear.dispose(); starMatFar.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [])

  return <div ref={hostRef} className="absolute inset-0" aria-hidden="true" />
}
