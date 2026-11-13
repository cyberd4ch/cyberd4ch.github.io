'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

/**
 * The homelab moved under projects (/projects/lab/) and left the primary
 * nav. Static export can't 301, so this stub sends old /lab links onward.
 */
export default function LabMovedPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/projects/lab/')
  }, [router])
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <p className="text-sm text-[var(--muted)]">
        the lab moved under projects —{' '}
        <Link href="/projects/lab/" className="underline-link font-medium text-[var(--fg)]">
          go to the lab
        </Link>
      </p>
    </div>
  )
}
