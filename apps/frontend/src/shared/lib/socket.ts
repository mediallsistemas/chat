import { io, type Socket } from 'socket.io-client'
import { useEffect, useState } from 'react'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000', {
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
