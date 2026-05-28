'use client'

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useUnitStore } from '@/store/unit-store'
import { api as axios } from '@/lib/api'
import { getSocket } from '@/lib/socket'
import { toast } from '@/hooks/use-toast'
import { getErrorMessage } from '@/lib/get-error-message'
import type {
  Meeting,
  ParticipantStatus,
  LiveKitTokenResponse,
  AgendaItem,
  RecordingConsentStatus,
  MeetingChatMessage,
  MeetingChatPage,
} from '@mediall/types'

function getUrl(unitId: string, path = '') {
  return `/units/${unitId}/meetings${path}`
}

// ─── Meeting CRUD ─────────────────────────────────────────────────────────────

export function useMeetings() {
  const unitId = useUnitStore((s) => s.activeUnit?.id)
  return useQuery({
    queryKey: ['meetings', unitId],
    queryFn: () =>
      axios.get<{ data: Meeting[] }>(getUrl(unitId!)).then((r) => r.data.data),
    enabled: !!unitId,
  })
}

export function useMeeting(meetingId: string) {
  const unitId = useUnitStore((s) => s.activeUnit?.id)
  return useQuery({
    queryKey: ['meetings', unitId, meetingId],
    queryFn: () =>
      axios.get<{ data: Meeting }>(getUrl(unitId!, `/${meetingId}`)).then((r) => r.data.data),
    enabled: !!unitId && !!meetingId,
  })
}

export function useCreateMeeting() {
  const unitId = useUnitStore((s) => s.activeUnit?.id)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      title: string
      description?: string
      startAt: string
      endAt: string
      groupId?: string
      isRecurring?: boolean
      recurrenceRule?: string
      participantIds?: string[]
    }) =>
      axios.post<{ data: Meeting }>(getUrl(unitId!), data).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meetings', unitId] })
      toast.success('Reunião criada')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

export function useCancelMeeting() {
  const unitId = useUnitStore((s) => s.activeUnit?.id)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (meetingId: string) =>
      axios.post(getUrl(unitId!, `/${meetingId}/cancel`)).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meetings', unitId] })
      toast.success('Reunião cancelada')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

export function useRespondMeeting() {
  const unitId = useUnitStore((s) => s.activeUnit?.id)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ meetingId, status }: { meetingId: string; status: ParticipantStatus }) =>
      axios
        .post(getUrl(unitId!, `/${meetingId}/respond`), { status })
        .then((r) => r.data.data),
    onSuccess: (_, { meetingId }) =>
      qc.invalidateQueries({ queryKey: ['meetings', unitId, meetingId] }),
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

export function useJoinMeeting() {
  const unitId = useUnitStore((s) => s.activeUnit?.id)
  return useMutation({
    mutationFn: (meetingId: string) =>
      axios
        .get<{ data: LiveKitTokenResponse }>(getUrl(unitId!, `/${meetingId}/token`))
        .then((r) => r.data.data),
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

export function useStartMeeting() {
  const unitId = useUnitStore((s) => s.activeUnit?.id)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (meetingId: string) =>
      axios.post(getUrl(unitId!, `/${meetingId}/start`)).then((r) => r.data.data),
    onSuccess: (_, meetingId) =>
      qc.invalidateQueries({ queryKey: ['meetings', unitId, meetingId] }),
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

export function useEndMeeting() {
  const unitId = useUnitStore((s) => s.activeUnit?.id)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (meetingId: string) =>
      axios.post(getUrl(unitId!, `/${meetingId}/end`)).then((r) => r.data.data),
    onSuccess: (_, meetingId) =>
      qc.invalidateQueries({ queryKey: ['meetings', unitId, meetingId] }),
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

// ─── Agenda ──────────────────────────────────────────────────────────────────

export function useAgenda(from: Date, to: Date) {
  const unitId = useUnitStore((s) => s.activeUnit?.id)
  return useQuery({
    queryKey: ['agenda', unitId, from.toISOString().slice(0, 10), to.toISOString().slice(0, 10)],
    queryFn: () =>
      axios
        .get<{ data: AgendaItem[] }>(getUrl(unitId!, '/agenda'), {
          params: { from: from.toISOString(), to: to.toISOString() },
        })
        .then((r) => r.data.data),
    enabled: !!unitId,
  })
}

// ─── Recording ───────────────────────────────────────────────────────────────

export function useRequestRecordingConsent() {
  const unitId = useUnitStore((s) => s.activeUnit?.id)
  return useMutation({
    mutationFn: (meetingId: string) =>
      axios
        .post(getUrl(unitId!, `/${meetingId}/recording/request-consent`))
        .then((r) => r.data.data),
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

export function useSubmitRecordingConsent() {
  const unitId = useUnitStore((s) => s.activeUnit?.id)
  return useMutation({
    mutationFn: (meetingId: string) =>
      axios
        .post<{ data: RecordingConsentStatus }>(
          getUrl(unitId!, `/${meetingId}/recording/consent`),
        )
        .then((r) => r.data.data),
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

export function useStartRecording() {
  const unitId = useUnitStore((s) => s.activeUnit?.id)
  return useMutation({
    mutationFn: (meetingId: string) =>
      axios
        .post(getUrl(unitId!, `/${meetingId}/recording/start`))
        .then((r) => r.data.data),
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

export function useStopRecording() {
  const unitId = useUnitStore((s) => s.activeUnit?.id)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (meetingId: string) =>
      axios
        .post<{ data: { recordingUrl: string } }>(
          getUrl(unitId!, `/${meetingId}/recording/stop`),
        )
        .then((r) => r.data.data),
    onSuccess: (_, meetingId) =>
      qc.invalidateQueries({ queryKey: ['meetings', unitId, meetingId] }),
  })
}

// ─── Meeting in-call chat ─────────────────────────────────────────────────────

export function useMeetingChat(meetingId: string | null) {
  const unitId = useUnitStore((s) => s.activeUnit?.id)
  const qc = useQueryClient()

  const query = useInfiniteQuery<MeetingChatPage>({
    queryKey: ['meeting-chat', unitId, meetingId],
    queryFn: async ({ pageParam }) => {
      const res = await axios.get<{ data: MeetingChatPage }>(
        getUrl(unitId!, `/${meetingId}/chat`),
        { params: pageParam ? { cursor: pageParam } : {} },
      )
      return res.data.data
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!unitId && !!meetingId,
  })

  useEffect(() => {
    if (!meetingId) return
    const socket = getSocket()
    socket.emit('join:meeting', meetingId)
    function onNew(msg: MeetingChatMessage) {
      if (msg.meetingId !== meetingId) return
      qc.setQueryData<{ pages: MeetingChatPage[]; pageParams: unknown[] }>(
        ['meeting-chat', unitId, meetingId],
        (old) => {
          if (!old) return old
          const pages = [...old.pages]
          const last = { ...pages[pages.length - 1] }
          last.messages = [...last.messages, msg]
          pages[pages.length - 1] = last
          return { ...old, pages }
        },
      )
    }
    socket.on('meeting-chat:message', onNew)
    return () => {
      socket.off('meeting-chat:message', onNew)
    }
  }, [meetingId, unitId, qc])

  return query
}

export function useSendMeetingChat(meetingId: string | null) {
  const unitId = useUnitStore((s) => s.activeUnit?.id)
  return useMutation({
    mutationFn: async (content: string) => {
      const res = await axios.post<{ data: MeetingChatMessage }>(
        getUrl(unitId!, `/${meetingId}/chat`),
        { content },
      )
      return res.data.data
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}
