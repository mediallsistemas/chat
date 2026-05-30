import { io, type Socket } from 'socket.io-client'
import { useEffect, useRef } from 'react'

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

export function useSocket(): Socket {
  const socketRef = useRef<Socket>(getSocket())
  useEffect(() => {
    const s = socketRef.current
    if (!s.connected) s.connect()
    return () => { s.disconnect() }
  }, [])
  return socketRef.current
}
