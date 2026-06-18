'use client'

import { useEffect, useState } from 'react'

function format(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(sec).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

/**
 * Live elapsed-time string (mm:ss, or h:mm:ss past an hour) since `startIso`,
 * ticking once per second. Pass null/undefined to pause. Used for the running
 * call timer in the huddle bubble and the chat header.
 */
export function useElapsed(startIso: string | null | undefined): string {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!startIso) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [startIso])

  if (!startIso) return '00:00'
  const start = new Date(startIso).getTime()
  if (Number.isNaN(start)) return '00:00'
  return format(Math.floor((now - start) / 1000))
}
