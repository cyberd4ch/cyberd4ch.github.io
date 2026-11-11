'use client'

import { useEffect, useState } from 'react'

/** Mission-control UTC clock. Renders a placeholder on the server, ticks for real on mount. */
export default function LocalClock({ className }: { className?: string }) {
  const [time, setTime] = useState('--:--:--')

  useEffect(() => {
    const tick = () => {
      const d = new Date()
      const pad = (n: number) => String(n).padStart(2, '0')
      setTime(`${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <span className={className} suppressHydrationWarning>
      {time} UTC
    </span>
  )
}
