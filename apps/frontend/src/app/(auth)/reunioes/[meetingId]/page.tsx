'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { clsx } from 'clsx'
import { Button } from '@/shared/components/ui'
import { useMeeting, useJoinMeeting, useStartMeeting, useEndMeeting } from '@/features/meetings/hooks/use-meetings'
import { useTranscript, useProcessTranscript } from '@/features/transcription/hooks/use-transcription'
import { useAuthStore } from '@/features/auth/store/auth-store'
import { MeetingStatus, ParticipantStatus } from '@mediall/types'
import type { LiveKitTokenResponse } from '@mediall/types'

const VideoRoom = dynamic(() => import('./video-room'), { ssr: false })

import { MeetingChatPanel } from './meeting-chat-panel'

const STATUS_LABEL: Record<MeetingStatus, string> = {
  [MeetingStatus.SCHEDULED]: 'Agendada',
  [MeetingStatus.IN_PROGRESS]: 'Em andamento',
  [MeetingStatus.DONE]: 'Encerrada',
  [MeetingStatus.CANCELLED]: 'Cancelada',
}

const PARTICIPANT_STATUS_LABEL: Record<ParticipantStatus, string> = {
  [ParticipantStatus.INVITED]: 'Convidado',
  [ParticipantStatus.ACCEPTED]: 'Confirmado',
  [ParticipantStatus.DECLINED]: 'Recusou',
  [ParticipantStatus.ATTENDED]: 'Participou',
}

export default function MeetingDetailPage() {
  const { meetingId } = useParams<{ meetingId: string }>()
  const router = useRouter()
  const user = useAuthStore((s) => s.user)

  const { data: meeting, isLoading } = useMeeting(meetingId)
  const joinMeeting = useJoinMeeting()
  const startMeeting = useStartMeeting()
  const endMeeting = useEndMeeting()

  const [liveKitSession, setLiveKitSession] = useState<LiveKitTokenResponse | null>(null)
  const [transcriptText, setTranscriptText] = useState('')
  const [chatHistoryOpen, setChatHistoryOpen] = useState(false)

  const { data: transcriptData } = useTranscript(meetingId)
  const processTranscript = useProcessTranscript(meetingId)

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-gs/10 rounded" />
        <div className="h-40 bg-gs/10 rounded-xl" />
      </div>
    )
  }

  if (!meeting) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gs">
        <i className="ti ti-video-off text-4xl mb-3 opacity-30" />
        <p>Reunião não encontrada.</p>
        <Button variant="secondary" className="mt-4" onClick={() => router.push('/reunioes')}>
          Voltar
        </Button>
      </div>
    )
  }

  const isOwner = meeting.createdBy === user?.id
  const start = new Date(meeting.startAt)
  const end = new Date(meeting.endAt)
  const myParticipant = meeting.participants?.find((p) => p.userId === user?.id)

  async function handleJoin() {
    const session = await joinMeeting.mutateAsync(meetingId)
    setLiveKitSession(session)
  }

  async function handleStart() {
    await startMeeting.mutateAsync(meetingId)
    const session = await joinMeeting.mutateAsync(meetingId)
    setLiveKitSession(session)
  }

  function handleLeave() {
    setLiveKitSession(null)
  }

  async function handleEnd() {
    await endMeeting.mutateAsync(meetingId)
    setLiveKitSession(null)
  }

  if (liveKitSession) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 bg-gd shrink-0">
          <span className="text-white font-semibold truncate">{meeting.title}</span>
          <div className="flex items-center gap-2">
            {isOwner && meeting.status === MeetingStatus.IN_PROGRESS && (
              <Button size="sm" variant="danger" onClick={handleEnd}>
                Encerrar reunião
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={handleLeave} className="text-white hover:bg-white/10">
              Sair da sala
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <VideoRoom
            token={liveKitSession.token}
            wsUrl={liveKitSession.wsUrl}
            meetingId={meetingId}
            isOwner={isOwner}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back */}
      <button
        onClick={() => router.push('/reunioes')}
        className="flex items-center gap-1 text-sm text-gs hover:text-gd transition-colors"
      >
        <i className="ti ti-arrow-left text-[16px]" /> Reuniões
      </button>

      {/* Header card */}
      <div className="bg-white rounded-xl border border-gs/60 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <span
              className={clsx(
                'inline-block text-xs font-semibold px-2 py-0.5 rounded-full mb-2',
                meeting.status === MeetingStatus.IN_PROGRESS
                  ? 'bg-green-50 text-green-700'
                  : meeting.status === MeetingStatus.SCHEDULED
                    ? 'bg-blue-50 text-blue-700'
                    : 'bg-gs/10 text-gs',
              )}
            >
              {STATUS_LABEL[meeting.status]}
            </span>
            <h1 className="text-2xl font-bold text-gd">{meeting.title}</h1>
            {meeting.description && (
              <p className="text-gs mt-1">{meeting.description}</p>
            )}
          </div>

          <div className="flex gap-2 shrink-0">
            {isOwner && meeting.status === MeetingStatus.SCHEDULED && (
              <Button onClick={handleStart} loading={startMeeting.isPending}>
                <i className="ti ti-video mr-1" /> Iniciar sala
              </Button>
            )}
            {meeting.status === MeetingStatus.IN_PROGRESS && (
              <Button onClick={handleJoin} loading={joinMeeting.isPending}>
                <i className="ti ti-video mr-1" /> Entrar na sala
              </Button>
            )}
          </div>
        </div>

        {/* Meta */}
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-gs border-t border-gs/20 pt-4">
          <span className="flex items-center gap-1.5">
            <i className="ti ti-calendar text-[15px]" />
            {format(start, "EEEE, d 'de' MMMM", { locale: ptBR })}
          </span>
          <span className="flex items-center gap-1.5">
            <i className="ti ti-clock text-[15px]" />
            {format(start, 'HH:mm')} – {format(end, 'HH:mm')}
          </span>
          {meeting.creator && (
            <span className="flex items-center gap-1.5">
              <i className="ti ti-user text-[15px]" />
              Criada por {meeting.creator.name}
            </span>
          )}
          {meeting.group && (
            <span className="flex items-center gap-1.5">
              <i className="ti ti-message-2 text-[15px]" />
              {meeting.group.name}
            </span>
          )}
        </div>
      </div>

      {/* Participants */}
      {meeting.participants && meeting.participants.length > 0 && (
        <div className="bg-white rounded-xl border border-gs/60 p-5">
          <h2 className="font-semibold text-gd mb-3">
            Participantes ({meeting.participants.length})
          </h2>
          <ul className="space-y-2">
            {meeting.participants.map((p) => (
              <li key={p.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-gn/20 flex items-center justify-center text-gd text-xs font-bold">
                    {p.user?.name?.charAt(0).toUpperCase() ?? '?'}
                  </div>
                  <span className="text-sm text-gd">
                    {p.user?.name ?? p.userId}
                    {p.userId === meeting.createdBy && (
                      <span className="ml-1 text-xs text-gs">(organizador)</span>
                    )}
                  </span>
                </div>
                <span
                  className={clsx(
                    'text-xs px-2 py-0.5 rounded-full',
                    p.status === ParticipantStatus.ACCEPTED || p.status === ParticipantStatus.ATTENDED
                      ? 'bg-green-50 text-green-700'
                      : p.status === ParticipantStatus.DECLINED
                        ? 'bg-red-50 text-red-600'
                        : 'bg-yellow-50 text-yellow-700',
                  )}
                >
                  {PARTICIPANT_STATUS_LABEL[p.status]}
                </span>
              </li>
            ))}
          </ul>

          {/* Invite response for current user */}
          {myParticipant?.status === ParticipantStatus.INVITED && (
            <div className="mt-4 pt-4 border-t border-gs/20 flex items-center gap-2">
              <span className="text-sm text-gs flex-1">Você foi convidado para esta reunião.</span>
            </div>
          )}
        </div>
      )}

      {/* Meeting chat history */}
      {meeting.status === MeetingStatus.DONE && myParticipant && (
        <div className="bg-white rounded-xl border border-gs/60 p-5 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gd flex items-center gap-2">
              <i className="ti ti-message-circle" />
              Chat da reunião
            </h2>
            <p className="text-xs text-gs mt-1">Mensagens trocadas durante a reunião.</p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => setChatHistoryOpen(true)}>
            Ver histórico
          </Button>
        </div>
      )}

      {chatHistoryOpen && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/40">
          <div className="h-full bg-white shadow-xl">
            <MeetingChatPanel
              meetingId={meetingId}
              readOnly
              onClose={() => setChatHistoryOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Transcript section */}
      <div className="bg-white rounded-xl border border-gs/60 p-5">
        <h2 className="font-semibold text-gd mb-4 flex items-center gap-2">
          <i className="ti ti-sparkles text-gn" />
          Transcrição e IA
        </h2>

        {transcriptData?.transcriptedAt ? (
          <div className="space-y-4">
            <p className="text-xs text-gs">
              Processado em {format(new Date(transcriptData.transcriptedAt), "d 'de' MMMM 'às' HH:mm", { locale: ptBR })}
            </p>

            {transcriptData.transcriptSummary && (
              <div>
                <h3 className="text-sm font-semibold text-gd mb-1">Resumo</h3>
                <p className="text-sm text-gs whitespace-pre-wrap">{transcriptData.transcriptSummary}</p>
              </div>
            )}

            {transcriptData.transcriptActionItems && (
              <>
                {(transcriptData.transcriptActionItems as { actionItems?: Array<{ action: string; responsible?: string; deadline?: string }> }).actionItems?.length ? (
                  <div>
                    <h3 className="text-sm font-semibold text-gd mb-2">Itens de ação</h3>
                    <ul className="space-y-1.5">
                      {(transcriptData.transcriptActionItems as { actionItems: Array<{ action: string; responsible?: string; deadline?: string }> }).actionItems.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <i className="ti ti-circle-check text-gn mt-0.5 shrink-0" />
                          <div>
                            <span className="text-gd">{item.action}</span>
                            {(item.responsible || item.deadline) && (
                              <span className="text-xs text-gs ml-2">
                                {item.responsible && `— ${item.responsible}`}
                                {item.deadline && ` · ${item.deadline}`}
                              </span>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {(transcriptData.transcriptActionItems as { keyDecisions?: string[] }).keyDecisions?.length ? (
                  <div>
                    <h3 className="text-sm font-semibold text-gd mb-2">Decisões-chave</h3>
                    <ul className="space-y-1.5">
                      {(transcriptData.transcriptActionItems as { keyDecisions: string[] }).keyDecisions.map((d, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <i className="ti ti-arrow-right text-gn mt-0.5 shrink-0" />
                          <span className="text-gd">{d}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gs">Cole a transcrição da reunião para gerar resumo e itens de ação automaticamente.</p>
            <textarea
              value={transcriptText}
              onChange={(e) => setTranscriptText(e.target.value)}
              className="input w-full resize-none text-sm"
              rows={6}
              placeholder="Cole aqui o texto da transcrição da reunião..."
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={() => processTranscript.mutate(transcriptText)}
                loading={processTranscript.isPending}
                disabled={!transcriptText.trim()}
              >
                <i className="ti ti-sparkles mr-1" /> Processar com IA
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
