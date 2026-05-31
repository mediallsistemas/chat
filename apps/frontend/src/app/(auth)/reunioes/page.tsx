'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format, isPast, isToday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { clsx } from 'clsx'
import { PageHeader } from '@/components/shared'
import { Button, FormModal, ConfirmDialog } from '@/components/ui'
import { useMeetings, useCreateMeeting, useCancelMeeting } from '@/hooks/use-meetings'
import { useAuthStore } from '@/store/auth-store'
import { MeetingStatus, ParticipantStatus } from '@mediall/types'
import type { Meeting } from '@mediall/types'

const STATUS_CONFIG: Record<
  MeetingStatus,
  { label: string; bg: string; text: string; dot: string }
> = {
  [MeetingStatus.SCHEDULED]: {
    label: 'Agendada',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    dot: 'bg-blue-500',
  },
  [MeetingStatus.IN_PROGRESS]: {
    label: 'Em andamento',
    bg: 'bg-green-50',
    text: 'text-green-700',
    dot: 'bg-green-500',
  },
  [MeetingStatus.DONE]: {
    label: 'Encerrada',
    bg: 'bg-gs/10',
    text: 'text-gs',
    dot: 'bg-gs',
  },
  [MeetingStatus.CANCELLED]: {
    label: 'Cancelada',
    bg: 'bg-red-50',
    text: 'text-red-600',
    dot: 'bg-red-400',
  },
}

const RRULE_OPTIONS = [
  { value: '', label: 'Não repetir' },
  { value: 'FREQ=DAILY', label: 'Diariamente' },
  { value: 'FREQ=WEEKLY', label: 'Semanalmente' },
  { value: 'FREQ=MONTHLY', label: 'Mensalmente' },
]

const createSchema = z
  .object({
    title: z.string().min(3, 'Título deve ter ao menos 3 caracteres'),
    description: z.string().optional(),
    startAt: z.string().min(1, 'Informe a data/hora de início'),
    endAt: z.string().min(1, 'Informe a data/hora de término'),
    recurrenceRule: z.string().optional(),
  })
  .refine((d) => new Date(d.endAt) > new Date(d.startAt), {
    message: 'O término deve ser após o início',
    path: ['endAt'],
  })
type CreateForm = z.infer<typeof createSchema>

function MeetingCard({
  meeting,
  userId,
  onCancel,
}: {
  meeting: Meeting
  userId: string
  onCancel: (id: string) => void
}) {
  const router = useRouter()
  const cfg = STATUS_CONFIG[meeting.status]
  const start = new Date(meeting.startAt)
  const isOwner = meeting.createdBy === userId
  const myParticipant = meeting.participants?.find((p) => p.userId === userId)
  const isPending = myParticipant?.status === ParticipantStatus.INVITED

  return (
    <div className="bg-white rounded-xl border border-gs/60 p-4 flex items-start gap-4 hover:border-gn/40 transition-colors">
      {/* Date badge */}
      <div className="shrink-0 w-12 text-center">
        <div className="text-2xl font-bold text-gd leading-none">{format(start, 'd')}</div>
        <div className="text-xs text-gs uppercase tracking-wide">
          {format(start, 'MMM', { locale: ptBR })}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span
            className={clsx(
              'inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full',
              cfg.bg,
              cfg.text,
            )}
          >
            <span className={clsx('w-1.5 h-1.5 rounded-full', cfg.dot)} />
            {cfg.label}
          </span>
          {isPending && (
            <span className="text-xs bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
              Convite pendente
            </span>
          )}
        </div>

        <h3 className="font-semibold text-gd truncate">{meeting.title}</h3>
        {meeting.description && (
          <p className="text-sm text-gs mt-0.5 line-clamp-1">{meeting.description}</p>
        )}

        <div className="flex items-center gap-3 mt-2 text-xs text-gs">
          <span className="flex items-center gap-1">
            <i className="ti ti-clock text-[13px]" />
            {format(start, 'HH:mm')} – {format(new Date(meeting.endAt), 'HH:mm')}
          </span>
          <span className="flex items-center gap-1">
            <i className="ti ti-users text-[13px]" />
            {meeting._count?.participants ?? meeting.participants?.length ?? 0} participantes
          </span>
          {meeting.creator && (
            <span className="flex items-center gap-1">
              <i className="ti ti-user text-[13px]" />
              {meeting.creator.name}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {(meeting.status === MeetingStatus.SCHEDULED ||
          meeting.status === MeetingStatus.IN_PROGRESS) && (
          <Button
            size="sm"
            variant={meeting.status === MeetingStatus.IN_PROGRESS ? 'primary' : 'outline'}
            onClick={() => router.push(`/reunioes/${meeting.id}`)}
          >
            {meeting.status === MeetingStatus.IN_PROGRESS ? 'Entrar' : 'Abrir'}
          </Button>
        )}
        {isOwner &&
          meeting.status === MeetingStatus.SCHEDULED && (
            <button
              onClick={() => onCancel(meeting.id)}
              className="p-1.5 rounded-lg text-gs hover:text-red-500 hover:bg-red-50 transition-colors"
              aria-label="Cancelar reunião"
              title="Cancelar reunião"
            >
              <i className="ti ti-x text-[16px]" />
            </button>
          )}
      </div>
    </div>
  )
}

export default function ReunioesPage() {
  const router = useRouter()
  const [showCreate, setShowCreate] = useState(false)
  const [cancelId, setCancelId] = useState<string | null>(null)
  const [pastLimit, setPastLimit] = useState(10)
  const { data: meetings = [], isLoading } = useMeetings()
  const createMeeting = useCreateMeeting()
  const cancelMeeting = useCancelMeeting()
  const user = useAuthStore((s) => s.user)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateForm>({ resolver: zodResolver(createSchema) })

  const live = meetings.filter((m) => m.status === MeetingStatus.IN_PROGRESS)
  const upcoming = meetings.filter(
    (m) => m.status === MeetingStatus.SCHEDULED && !isPast(new Date(m.startAt)),
  )
  const past = meetings.filter(
    (m) =>
      m.status === MeetingStatus.DONE ||
      m.status === MeetingStatus.CANCELLED ||
      (m.status === MeetingStatus.SCHEDULED && isPast(new Date(m.startAt))),
  )

  async function onSubmit(values: CreateForm) {
    await createMeeting.mutateAsync({
      ...values,
      isRecurring: !!values.recurrenceRule,
      recurrenceRule: values.recurrenceRule || undefined,
    })
    reset()
    setShowCreate(false)
  }

  function handleCancel(meetingId: string) {
    setCancelId(meetingId)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Reuniões"
          subtitle="Videoconferências e reuniões da equipe"
        />
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.push('/reunioes/agenda')}>
            <i className="ti ti-calendar mr-1" /> Agenda
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <i className="ti ti-plus mr-1" /> Nova Reunião
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-gs/10 animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && (
        <>
          {live.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gs uppercase tracking-wide mb-3">
                Em andamento
              </h2>
              <div className="space-y-3">
                {live.map((m) => (
                  <MeetingCard
                    key={m.id}
                    meeting={m}
                    userId={user?.id ?? ''}
                    onCancel={handleCancel}
                  />
                ))}
              </div>
            </section>
          )}

          {upcoming.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gs uppercase tracking-wide mb-3">
                Próximas
              </h2>
              <div className="space-y-3">
                {upcoming.map((m) => (
                  <MeetingCard
                    key={m.id}
                    meeting={m}
                    userId={user?.id ?? ''}
                    onCancel={handleCancel}
                  />
                ))}
              </div>
            </section>
          )}

          {live.length === 0 && upcoming.length === 0 && (
            <div className="text-center py-16 text-gs">
              <i className="ti ti-video-off text-4xl mb-3 block opacity-30" />
              <p className="font-medium">Nenhuma reunião agendada</p>
              <p className="text-sm mt-1">Crie uma nova reunião para começar</p>
            </div>
          )}

          {past.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gs uppercase tracking-wide mb-3">
                Anteriores
              </h2>
              <div className="space-y-3 opacity-70">
                {past.slice(0, pastLimit).map((m) => (
                  <MeetingCard
                    key={m.id}
                    meeting={m}
                    userId={user?.id ?? ''}
                    onCancel={handleCancel}
                  />
                ))}
              </div>
              {past.length > pastLimit && (
                <div className="flex justify-center mt-3">
                  <Button size="sm" variant="secondary" onClick={() => setPastLimit((n) => n + 10)}>
                    Ver mais ({past.length - pastLimit})
                  </Button>
                </div>
              )}
            </section>
          )}
        </>
      )}

      <FormModal
        open={showCreate}
        onClose={() => { reset(); setShowCreate(false) }}
        title="Nova Reunião"
        onSubmit={handleSubmit(onSubmit)}
        isPending={isSubmitting}
        submitLabel="Agendar"
      >
        <div>
          <label className="block text-sm font-medium text-gd mb-1">Título</label>
          <input
            {...register('title')}
            className="input w-full"
            placeholder="Ex.: Reunião de planejamento"
          />
          {errors.title && (
            <p className="text-xs text-red-500 mt-1">{errors.title.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gd mb-1">
            Descrição <span className="text-gs font-normal">(opcional)</span>
          </label>
          <textarea
            {...register('description')}
            className="input w-full resize-none"
            rows={2}
            placeholder="Pauta ou objetivo da reunião"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gd mb-1">Início</label>
            <input type="datetime-local" {...register('startAt')} className="input w-full" />
            {errors.startAt && (
              <p className="text-xs text-red-500 mt-1">{errors.startAt.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gd mb-1">Término</label>
            <input type="datetime-local" {...register('endAt')} className="input w-full" />
            {errors.endAt && (
              <p className="text-xs text-red-500 mt-1">{errors.endAt.message}</p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gd mb-1">Repetição</label>
          <select {...register('recurrenceRule')} className="input w-full">
            {RRULE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </FormModal>

      <ConfirmDialog
        open={cancelId !== null}
        onClose={() => setCancelId(null)}
        onConfirm={() => {
          if (cancelId) cancelMeeting.mutate(cancelId, { onSuccess: () => setCancelId(null) })
        }}
        title="Cancelar reunião"
        message="Cancelar esta reunião? Os participantes serão notificados e a reunião não poderá ser reaberta."
        confirmLabel="Cancelar reunião"
        cancelLabel="Voltar"
        loading={cancelMeeting.isPending}
      />
    </div>
  )
}
