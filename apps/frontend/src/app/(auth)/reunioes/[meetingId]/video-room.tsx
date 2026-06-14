'use client'

import '@livekit/components-styles'
import { LiveKitRoom, VideoConference, useRoomContext } from '@livekit/components-react'
import { useState, useEffect } from 'react'
import { clsx } from 'clsx'
import {
  useRequestRecordingConsent,
  useSubmitRecordingConsent,
  useStartRecording,
  useStopRecording,
} from '@/features/meetings/hooks/use-meetings'
import { useSocket } from '@/shared/lib/socket'
import { MeetingChatPanel } from './meeting-chat-panel'

// ─── Recording Controls (rendered inside LiveKitRoom context) ─────────────────

function RecordingControls({
  meetingId,
  isOwner,
}: {
  meetingId: string
  isOwner: boolean
}) {
  const socket = useSocket()
  const requestConsent = useRequestRecordingConsent()
  const submitConsent = useSubmitRecordingConsent()
  const startRecording = useStartRecording()
  const stopRecording = useStopRecording()

  const [consentState, setConsentState] = useState<{
    requested?: boolean
    meetingId?: string
    consentedCount: number
    totalRequired: number
    allConsented: boolean
  } | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [showConsentModal, setShowConsentModal] = useState(false)
  const [consented, setConsented] = useState(false)

  useEffect(() => {
    if (!socket) return

    socket.on('recording:consent:request', ({ meetingId: mid }: { meetingId: string }) => {
      if (mid === meetingId) setShowConsentModal(true)
    })

    socket.on(
      'recording:consent:update',
      (data: {
        meetingId: string
        consentedCount: number
        totalRequired: number
        allConsented: boolean
      }) => {
        if (data.meetingId === meetingId) setConsentState(data)
      },
    )

    socket.on('recording:started', ({ meetingId: mid }: { meetingId: string }) => {
      if (mid === meetingId) setIsRecording(true)
    })

    socket.on('recording:stopped', ({ meetingId: mid }: { meetingId: string }) => {
      if (mid === meetingId) setIsRecording(false)
    })

    return () => {
      socket.off('recording:consent:request')
      socket.off('recording:consent:update')
      socket.off('recording:started')
      socket.off('recording:stopped')
    }
  }, [socket, meetingId])

  async function handleRequestConsent() {
    await requestConsent.mutateAsync(meetingId)
    setConsentState({ requested: true, consentedCount: 0, totalRequired: 0, allConsented: false })
  }

  async function handleConsent() {
    const result = await submitConsent.mutateAsync(meetingId)
    setConsentState(result)
    setConsented(true)
    setShowConsentModal(false)
  }

  async function handleStartRecording() {
    await startRecording.mutateAsync(meetingId)
    setIsRecording(true)
  }

  async function handleStopRecording() {
    await stopRecording.mutateAsync(meetingId)
    setIsRecording(false)
    setConsentState(null)
  }

  return (
    <>
      {/* Recording button bar */}
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
        {isRecording ? (
          <button
            onClick={handleStopRecording}
            disabled={stopRecording.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            Parar gravação
          </button>
        ) : isOwner ? (
          consentState?.allConsented ? (
            <button
              onClick={handleStartRecording}
              disabled={startRecording.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <i className="ti ti-record-mail text-[16px]" />
              Iniciar gravação
            </button>
          ) : consentState ? (
            <div className="flex items-center gap-2 px-4 py-2 bg-black/60 text-white text-sm rounded-lg">
              <i className="ti ti-loader animate-spin text-[14px]" />
              Aguardando consentimento ({consentState.consentedCount}/{consentState.totalRequired})
            </div>
          ) : (
            <button
              onClick={handleRequestConsent}
              disabled={requestConsent.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-black/60 hover:bg-black/80 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <i className="ti ti-record-mail text-[16px]" />
              Gravar reunião
            </button>
          )
        ) : null}
      </div>

      {/* Consent modal for non-owners */}
      {showConsentModal && !consented && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <i className="ti ti-record-mail text-red-600 text-xl" />
              </div>
              <div>
                <h3 className="font-bold text-gd">Solicitação de gravação</h3>
                <p className="text-xs text-gs">O organizador deseja gravar esta reunião</p>
              </div>
            </div>
            <p className="text-sm text-gs mb-5">
              Ao aceitar, você concorda que esta reunião será gravada e armazenada. A gravação
              ficará disponível para os participantes após o encerramento.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowConsentModal(false)}
                className="flex-1 py-2 border border-gs/40 rounded-lg text-sm text-gd hover:bg-gs/10 transition-colors"
              >
                Recusar
              </button>
              <button
                onClick={handleConsent}
                disabled={submitConsent.isPending}
                className="flex-1 py-2 bg-gn text-gd rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Aceitar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Main VideoRoom component ─────────────────────────────────────────────────

interface VideoRoomProps {
  token: string
  wsUrl: string
  meetingId: string
  isOwner: boolean
}

export default function VideoRoom({ token, wsUrl, meetingId, isOwner }: VideoRoomProps) {
  const [chatOpen, setChatOpen] = useState(false)

  return (
    <div className="relative h-full w-full flex">
      <div className="relative flex-1">
        <LiveKitRoom
          token={token}
          serverUrl={wsUrl}
          data-lk-theme="default"
          style={{ height: '100%', width: '100%' }}
          video={true}
          audio={true}
        >
          <VideoConference />
          <RecordingControls meetingId={meetingId} isOwner={isOwner} />
        </LiveKitRoom>

        {/* Chat toggle */}
        <button
          onClick={() => setChatOpen((v) => !v)}
          className={clsx(
            'absolute top-4 right-4 z-10 flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors',
            chatOpen
              ? 'bg-gd text-white'
              : 'bg-black/60 hover:bg-black/80 text-white',
          )}
          aria-label="Alternar chat"
        >
          <i className="ti ti-message-circle text-base" aria-hidden="true" />
          Chat
        </button>
      </div>

      {chatOpen && (
        <MeetingChatPanel meetingId={meetingId} onClose={() => setChatOpen(false)} />
      )}
    </div>
  )
}
