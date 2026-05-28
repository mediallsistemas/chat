'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { clsx } from 'clsx'
import { Avatar, Button } from '@/components/ui'
import { useAuthStore } from '@/store/auth-store'
import { useMyDashboard } from '@/hooks/use-me'
import { ImpedimentStatus, type MyTask } from '@mediall/types'
import { TaskStatusModal } from './task-status-modal'

function weekdayDate(d: Date): string {
  return d.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  })
}

function timeOnly(d: Date): string {
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function relativeDay(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((d.getTime() - now.getTime()) / 86_400_000)
  if (diffDays < 0) return `atrasou ${-diffDays}d`
  if (diffDays === 0) return 'hoje'
  if (diffDays === 1) return 'amanhã'
  return `em ${diffDays}d`
}

export default function MeuPage() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const { data, isLoading, isError, refetch } = useMyDashboard()
  const [openTask, setOpenTask] = useState<MyTask | null>(null)

  const today = new Date()

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4 animate-pulse">
        <div className="h-12 w-2/3 bg-gs/10 rounded" />
        <div className="h-32 bg-gs/10 rounded-2xl" />
        <div className="h-32 bg-gs/10 rounded-2xl" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <i className="ti ti-cloud-off text-4xl text-gx mb-3 block" aria-hidden="true" />
        <p className="text-sm text-gx">Não foi possível carregar seu painel.</p>
        <Button size="sm" variant="secondary" className="mt-3" onClick={() => refetch()}>
          Tentar novamente
        </Button>
      </div>
    )
  }

  const { todayTasks, weekTasks, myImpediments, upcomingMeetings, unreadGroups } = data
  const allEmpty =
    todayTasks.length === 0 &&
    weekTasks.length === 0 &&
    myImpediments.length === 0 &&
    upcomingMeetings.length === 0 &&
    unreadGroups.length === 0

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Greeting */}
      <header>
        <h1 className="text-2xl font-semibold text-gd">
          Olá, {user?.name?.split(' ')[0] ?? ''}.
        </h1>
        <p className="text-sm text-gx mt-1 capitalize">{weekdayDate(today)}</p>
      </header>

      {allEmpty && (
        <div className="bg-white rounded-2xl border border-gs/60 p-8 text-center">
          <i className="ti ti-coffee text-4xl text-gx mb-3 block" aria-hidden="true" />
          <p className="text-sm font-medium text-gd">Tudo em dia.</p>
          <p className="text-xs text-gx mt-1">
            Você não tem tarefas pendentes nem impedimentos abertos no momento.
          </p>
        </div>
      )}

      {/* Precisa de você hoje */}
      {(todayTasks.length > 0 || myImpediments.length > 0) && (
        <section className="bg-white rounded-2xl border border-gs/60 overflow-hidden">
          <header className="px-4 py-3 border-b border-gs/40 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-gd">Precisa de você hoje</h2>
          </header>

          {todayTasks.map((t) => (
            <button
              key={t.id}
              onClick={() => setOpenTask(t)}
              className="w-full text-left px-4 py-3 border-b border-gs/20 hover:bg-page-bg transition-colors flex items-start gap-3"
            >
              <i
                className={clsx(
                  'ti text-base mt-0.5',
                  t.isBlocked ? 'ti-alert-triangle text-red-500' : 'ti-checkbox text-gd',
                )}
                aria-hidden="true"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gd truncate">{t.title}</p>
                <p className="text-[11px] text-gx mt-0.5">
                  {t.column.name} · {t.board.name}
                  {t.dueDate && (
                    <>
                      {' · '}
                      <span className={t.dueDate < today.toISOString() ? 'text-red-500' : ''}>
                        {relativeDay(t.dueDate)}
                      </span>
                    </>
                  )}
                </p>
              </div>
              <i className="ti ti-chevron-right text-gx text-sm mt-1" aria-hidden="true" />
            </button>
          ))}

          {myImpediments.map((imp) => (
            <div
              key={imp.id}
              className="px-4 py-3 border-b border-gs/20 last:border-b-0 flex items-start gap-3"
            >
              <i className="ti ti-flag-3 text-red-500 text-base mt-0.5" aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gd truncate">{imp.task.title}</p>
                <p className="text-[11px] text-gx mt-0.5">
                  Impedimento · escalation {imp.escalationLevel} ·{' '}
                  {imp.status === ImpedimentStatus.BLOCKED ? 'bloqueado' : 'atenção'}
                </p>
                <p className="text-xs text-gray-700 mt-1 line-clamp-2">{imp.description}</p>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Próximas reuniões */}
      {upcomingMeetings.length > 0 && (
        <section className="bg-white rounded-2xl border border-gs/60 overflow-hidden">
          <header className="px-4 py-3 border-b border-gs/40 flex items-center gap-2">
            <i className="ti ti-video text-gd text-base" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-gd">Próximas reuniões</h2>
          </header>
          {upcomingMeetings.map((m) => {
            const start = new Date(m.startAt)
            return (
              <button
                key={m.id}
                onClick={() => router.push(`/reunioes/${m.id}`)}
                className="w-full text-left px-4 py-3 border-b border-gs/20 last:border-b-0 hover:bg-page-bg transition-colors flex items-start gap-3"
              >
                <div className="w-12 shrink-0 text-center">
                  <p className="text-xs text-gx uppercase">
                    {start.toLocaleDateString('pt-BR', { weekday: 'short' })}
                  </p>
                  <p className="text-base font-semibold text-gd leading-tight">{timeOnly(start)}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gd truncate">{m.title}</p>
                  <p className="text-[11px] text-gx mt-0.5">
                    até {timeOnly(new Date(m.endAt))}
                  </p>
                </div>
                <i className="ti ti-chevron-right text-gx text-sm mt-1" aria-hidden="true" />
              </button>
            )
          })}
        </section>
      )}

      {/* Conversas com novidade */}
      {unreadGroups.length > 0 && (
        <section className="bg-white rounded-2xl border border-gs/60 overflow-hidden">
          <header className="px-4 py-3 border-b border-gs/40 flex items-center gap-2">
            <i className="ti ti-message-circle text-gd text-base" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-gd">Conversas com novidade</h2>
          </header>
          {unreadGroups.map((u) => (
            <button
              key={u.group.id}
              onClick={() => router.push(`/mensagens?groupId=${u.group.id}`)}
              className="w-full text-left px-4 py-3 border-b border-gs/20 last:border-b-0 hover:bg-page-bg transition-colors flex items-start gap-3"
            >
              <Avatar name={u.group.name} src={u.group.avatarUrl} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-medium text-gd truncate">{u.group.name}</p>
                  <span className="text-[10px] text-gx shrink-0">
                    {new Date(u.lastMessage.createdAt).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="text-xs text-gray-700 truncate">
                  <span className="font-medium">{u.lastMessage.sender.name}:</span>{' '}
                  {u.lastMessage.content || '(anexo)'}
                </p>
              </div>
              <span className="shrink-0 text-[10px] font-bold text-white bg-gd rounded-full px-1.5 py-0.5 self-center">
                {u.unreadCount}
              </span>
            </button>
          ))}
        </section>
      )}

      {/* Tarefas da semana */}
      {weekTasks.length > 0 && (
        <section className="bg-white rounded-2xl border border-gs/60 overflow-hidden">
          <header className="px-4 py-3 border-b border-gs/40 flex items-center gap-2">
            <i className="ti ti-calendar-week text-gd text-base" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-gd">Suas tarefas da semana</h2>
          </header>
          {weekTasks.map((t) => (
            <button
              key={t.id}
              onClick={() => setOpenTask(t)}
              className="w-full text-left px-4 py-3 border-b border-gs/20 last:border-b-0 hover:bg-page-bg transition-colors flex items-start gap-3"
            >
              <i className="ti ti-circle-dashed text-gd text-base mt-0.5" aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gd truncate">{t.title}</p>
                <p className="text-[11px] text-gx mt-0.5">
                  {t.column.name} · {relativeDay(t.dueDate)}
                </p>
              </div>
              <i className="ti ti-chevron-right text-gx text-sm mt-1" aria-hidden="true" />
            </button>
          ))}
        </section>
      )}

      <TaskStatusModal task={openTask} onClose={() => setOpenTask(null)} />
    </div>
  )
}
