'use client'

import '@livekit/components-styles'
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useLocalParticipant,
  useParticipants,
} from '@livekit/components-react'
import { useState } from 'react'
import { clsx } from 'clsx'
import { useLeaveHuddle } from '@/hooks/use-chat'
import type { HuddleTokenResponse } from '@mediall/types'

interface Props {
  session: HuddleTokenResponse
  onLeave: () => void
}

/**
 * Floating audio-only LiveKit room that stays visible while the user
 * navigates the rest of /mensagens. Closing leaves the huddle.
 */
export function HuddleMini({ session, onLeave }: Props) {
  return (
    <LiveKitRoom
      token={session.token}
      serverUrl={session.wsUrl}
      audio={true}
      video={false}
      connect
      className="fixed bottom-4 right-4 z-50 w-72 bg-gd text-white rounded-2xl shadow-2xl"
    >
      <RoomAudioRenderer />
      <HuddleControls huddleId={session.huddleId} onLeave={onLeave} />
    </LiveKitRoom>
  )
}

function HuddleControls({ huddleId, onLeave }: { huddleId: string; onLeave: () => void }) {
  const { localParticipant } = useLocalParticipant()
  const participants = useParticipants()
  const { mutate: leaveServer } = useLeaveHuddle()
  const [muted, setMuted] = useState(false)

  function toggleMute() {
    const next = !muted
    setMuted(next)
    localParticipant?.setMicrophoneEnabled(!next)
  }

  function handleLeave() {
    leaveServer(huddleId)
    onLeave()
  }

  return (
    <div className="p-3 flex items-center gap-3">
      <div className="relative">
        <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center">
          <i className="ti ti-headphones text-lg" aria-hidden="true" />
        </div>
        <span className="absolute -bottom-1 -right-1 text-[10px] bg-white text-gd rounded-full px-1.5 py-0.5 leading-none font-semibold">
          {participants.length}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate">Huddle ativo</p>
        <p className="text-[10px] opacity-80 truncate">
          {participants.length} {participants.length === 1 ? 'pessoa' : 'pessoas'}
        </p>
      </div>
      <button
        onClick={toggleMute}
        className={clsx(
          'p-2 rounded-lg transition-colors',
          muted ? 'bg-red-500 hover:bg-red-600' : 'bg-white/15 hover:bg-white/25',
        )}
        aria-label={muted ? 'Reativar microfone' : 'Silenciar'}
        title={muted ? 'Reativar microfone' : 'Silenciar'}
      >
        <i
          className={clsx('ti text-sm', muted ? 'ti-microphone-off' : 'ti-microphone')}
          aria-hidden="true"
        />
      </button>
      <button
        onClick={handleLeave}
        className="p-2 rounded-lg bg-red-500 hover:bg-red-600 transition-colors"
        aria-label="Sair do huddle"
        title="Sair do huddle"
      >
        <i className="ti ti-phone-off text-sm" aria-hidden="true" />
      </button>
    </div>
  )
}
