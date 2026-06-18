'use client'

import '@livekit/components-styles'
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useLocalParticipant,
  useParticipants,
} from '@livekit/components-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { useLeaveHuddle } from '@/features/chat/hooks/use-chat'
import { toast } from '@/shared/hooks/use-toast'
import { useElapsed } from '@/shared/hooks/use-elapsed'
import { getSocket } from '@/shared/lib/socket'
import type { HuddleTokenResponse } from '@mediall/types'

interface Props {
  session: HuddleTokenResponse
  onLeave: () => void
}

// Remember where the user parked the floating card, across calls and reloads.
const POS_STORAGE_KEY = 'mediall-call-card-pos'
// Keep at least this many px between the card and the viewport edges.
const EDGE_MARGIN = 12

/**
 * Floating audio-only call that stays visible while the user navigates the
 * rest of /mensagens. The visible card is our own draggable <div>; LiveKitRoom
 * is only the room-context provider, neutralised with display:contents so its
 * `.lk-room-container` styles (background/position/width:100%) don't fight our
 * card — those would otherwise blank out the panel and shove it to the top.
 */
export function HuddleMini({ session, onLeave }: Props) {
  return (
    <LiveKitRoom
      token={session.token}
      serverUrl={session.wsUrl}
      // Connect WITHOUT auto-publishing the mic: a machine with no/blocked
      // microphone (NotFoundError) would otherwise fail the whole connect.
      // The user joins as listener and enables the mic via the control button.
      audio={false}
      video={false}
      connect
      onError={(err) => {
        // Media-device problems are not connection failures — the room is
        // already up and the user can still listen. Never tear the call down
        // for them; only a real connection error calls onLeave().
        if (err.name === 'NotFoundError' || err.name === 'NotAllowedError') {
          console.warn('Call media device unavailable', err)
          return
        }
        console.error('Call connection error', err)
        toast.error('Não foi possível conectar à chamada. Verifique sua conexão e tente novamente.')
        onLeave()
      }}
      onMediaDeviceFailure={(failure) => {
        console.warn('Call media device failure', failure)
      }}
      style={{ display: 'contents' }}
    >
      <RoomAudioRenderer />
      <HuddleControls huddleId={session.huddleId} startedAt={session.startedAt} onLeave={onLeave} />
    </LiveKitRoom>
  )
}

interface Position {
  left: number
  top: number
}

function HuddleControls({
  huddleId,
  startedAt,
  onLeave,
}: {
  huddleId: string
  startedAt: string
  onLeave: () => void
}) {
  const { localParticipant } = useLocalParticipant()
  const participants = useParticipants()
  const { mutate: leaveServer } = useLeaveHuddle()
  // Start muted: we connect without auto-publishing audio (see LiveKitRoom).
  const [muted, setMuted] = useState(true)
  // Running call duration since it started on the server (same for everyone).
  const elapsed = useElapsed(startedAt)

  const count = participants.length

  // ─── Drag-to-move (mouse + touch) ───────────────────────────────────────────
  const cardRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<Position | null>(null)
  const posRef = useRef<Position | null>(null)
  const grabOffset = useRef<{ x: number; y: number } | null>(null)

  const applyPos = useCallback((next: Position) => {
    posRef.current = next
    setPos(next)
  }, [])

  const clampToViewport = useCallback((left: number, top: number): Position => {
    const el = cardRef.current
    const w = el?.offsetWidth ?? 288
    const h = el?.offsetHeight ?? 88
    return {
      left: Math.min(Math.max(EDGE_MARGIN, left), window.innerWidth - w - EDGE_MARGIN),
      top: Math.min(Math.max(EDGE_MARGIN, top), window.innerHeight - h - EDGE_MARGIN),
    }
  }, [])

  // Restore the saved position (if still on-screen) or default to bottom-right.
  useEffect(() => {
    const el = cardRef.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    let next: Position = {
      left: window.innerWidth - width - 16,
      top: window.innerHeight - height - 16,
    }
    try {
      const saved = JSON.parse(localStorage.getItem(POS_STORAGE_KEY) || 'null')
      if (saved && typeof saved.left === 'number' && typeof saved.top === 'number') next = saved
    } catch {
      /* ignore malformed storage */
    }
    applyPos(clampToViewport(next.left, next.top))
  }, [applyPos, clampToViewport])

  // Keep it on-screen when the window resizes.
  useEffect(() => {
    function onResize() {
      if (posRef.current) applyPos(clampToViewport(posRef.current.left, posRef.current.top))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [applyPos, clampToViewport])

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const el = cardRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    grabOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!grabOffset.current) return
    applyPos(clampToViewport(e.clientX - grabOffset.current.x, e.clientY - grabOffset.current.y))
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!grabOffset.current) return
    grabOffset.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
    if (posRef.current) {
      try {
        localStorage.setItem(POS_STORAGE_KEY, JSON.stringify(posRef.current))
      } catch {
        /* storage may be unavailable; position just won't persist */
      }
    }
  }

  // ─── Call controls ──────────────────────────────────────────────────────────
  // Close the floating panel when the server ends this call (idle auto-close
  // or everyone left). The server also deletes the LiveKit room, which drops
  // the connection — this just tears down the UI in lockstep.
  useEffect(() => {
    const socket = getSocket()
    const onEnded = (data: { huddleId: string }) => {
      if (data.huddleId === huddleId) onLeave()
    }
    socket.on('huddle:ended', onEnded)
    return () => {
      socket.off('huddle:ended', onEnded)
    }
  }, [huddleId, onLeave])

  async function toggleMute() {
    const next = !muted
    try {
      // Enabling the mic lazily acquires the device — this throws if there's
      // no microphone or permission was denied. Keep the user in the call.
      await localParticipant?.setMicrophoneEnabled(!next)
      setMuted(next)
    } catch (err) {
      console.warn('Could not toggle microphone', err)
      setMuted(true)
      toast.error('Nenhum microfone disponível. Você continua na chamada, mas sem áudio.')
    }
  }

  function handleLeave() {
    leaveServer(huddleId)
    onLeave()
  }

  return (
    <div
      ref={cardRef}
      className="fixed z-50 w-72 select-none rounded-2xl bg-gd text-white shadow-2xl ring-1 ring-black/10"
      style={pos ? { left: pos.left, top: pos.top } : { right: 16, bottom: 16 }}
    >
      <div className="flex items-center gap-2 p-3">
        {/* Drag handle: icon + title (the buttons stay clickable, outside it) */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="flex min-w-0 flex-1 cursor-grab touch-none items-center gap-3 active:cursor-grabbing"
          title="Arraste para mover"
        >
          <div className="relative shrink-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15">
              <i className="ti ti-headphones text-lg" aria-hidden="true" />
            </div>
            <span className="absolute -bottom-1 -right-1 flex min-w-[18px] items-center justify-center rounded-full bg-gn px-1 text-[10px] font-semibold leading-tight text-gd">
              {count}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-gn"
                aria-hidden="true"
              />
              <p className="truncate text-sm font-semibold">Chamada ativa</p>
            </div>
            <p className="truncate text-[11px] text-white/70">
              <span className="font-semibold tabular-nums text-gn">{elapsed}</span>
              {' · '}
              {count} {count === 1 ? 'pessoa' : 'pessoas'}
            </p>
          </div>
        </div>

        {/* Mute toggle */}
        <button
          type="button"
          onClick={toggleMute}
          className={clsx(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors',
            'bg-white/15 hover:bg-white/25',
            muted && 'text-red-300',
          )}
          aria-label={muted ? 'Reativar microfone' : 'Silenciar microfone'}
          aria-pressed={muted}
          title={muted ? 'Reativar microfone' : 'Silenciar microfone'}
        >
          <i
            className={clsx('ti text-base', muted ? 'ti-microphone-off' : 'ti-microphone')}
            aria-hidden="true"
          />
        </button>

        {/* Leave (hang up) */}
        <button
          type="button"
          onClick={handleLeave}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-500 text-white transition-colors hover:bg-red-600"
          aria-label="Sair da chamada"
          title="Sair da chamada"
        >
          <i className="ti ti-phone-off text-base" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
