'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Global scroll-reveal driver: watches every `.reveal` element and adds
 * `.in-view` when it enters the viewport (one-shot). Re-runs per route so
 * client-side navigations reveal the next page too. Reduced-motion users
 * (and the CSS fallback in globals.css) get everything visible immediately.
 */
export default function Reveal() {
  const pathname = usePathname()

  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('.reveal:not(.in-view)'))
    if (els.length === 0) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      els.forEach(el => el.classList.add('in-view'))
      return
    }

    const io = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view')
            io.unobserve(entry.target)
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    )
    els.forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [pathname])

  return null
}
