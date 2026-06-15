import { io, type Socket } from 'socket.io-client'
import { useEffect, useState } from 'react'

let socket: Socket | null = null

// Resolve the Socket.IO endpoint.
//
// On a deployed host we connect to the SAME ORIGIN so the WebSocket rides the
// reverse proxy that already serves the app (nginx proxies `/socket.io/`), exactly
// like the HTTP API which uses the relative `/api/v1` path. A localhost URL baked
// into the production build (NEXT_PUBLIC_* is inlined at BUILD time, not runtime)
// is meaningless to a remote browser — it points at the user's own machine and is
// blocked as mixed-content over HTTPS, so the socket silently never connects and
// realtime updates only appear after a manual refresh.
//
// In local development the backend runs on a separate port with no proxy, so we
// honor an explicit localhost NEXT_PUBLIC_WS_URL.
function resolveSocketUrl(): string {
  // Server-side render: getSocket() is only invoked in the browser.
  if (typeof window === 'undefined') return process.env.NEXT_PUBLIC_WS_URL || ''
  const explicit = process.env.NEXT_PUBLIC_WS_URL
  // A real, non-localhost endpoint (separate API host) is always respected.
  if (explicit && !/localhost|127\.0\.0\.1/.test(explicit)) return explicit
  const { hostname, origin } = window.location
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1'
  if (isLocalhost) return explicit || origin
  // Deployed: ignore any stale localhost URL and ride the same-origin proxy.
  return origin
}

export function getSocket(): Socket {
  if (!socket) {
    socket = io(resolveSocketUrl(), {
      withCredentials: true,
      autoConnect: false,
    })
  }
  return socket
}

export function connectSocket() {
  getSocket().connect()
}

export function disconnectSocket() {
  socket?.disconnect()
  socket = null
}

export function useSocket(): Socket | null {
  const [sock, setSock] = useState<Socket | null>(null)
  useEffect(() => {
    const s = getSocket()
    if (!s.connected) s.connect()
    setSock(s)
    return () => { s.off() }
  }, [])
  return sock
}
