'use client'

import { useRef, useEffect } from 'react'
import { clsx } from 'clsx'
import { useNotifications } from '@/hooks/use-notifications'
import { NotificationType } from '@mediall/types'
import type { Notification } from '@mediall/types'

const TYPE_ICON: Record<NotificationType, string> = {
  [NotificationType.TASK_ASSIGNED]:      'ti-clipboard-text',
  [NotificationType.TASK_OVERDUE]:       'ti-alarm',
  [NotificationType.TASK_DUE_SOON]:      'ti-clock',
  [NotificationType.IMPEDIMENT_CREATED]: 'ti-alert-triangle',
  [NotificationType.IMPEDIMENT_ESCALATED]: 'ti-arrow-up',
  [NotificationType.IMPEDIMENT_RESOLVED]: 'ti-circle-check',
  [NotificationType.PHASE_UNLOCKED]:     'ti-lock-open',
  [NotificationType.PHASE_COMPLETED]:    'ti-trophy',
  [NotificationType.MENTION]:            'ti-at',
  [NotificationType.MEETING_REMINDER]:   'ti-video',
  [NotificationType.CHECKIN_REQUEST]:    'ti-refresh',
  [NotificationType.GOAL_AT_RISK]:       'ti-trending-down',
  [NotificationType.TRANSCRIPT_READY]:   'ti-file-text',
  [NotificationType.TICKET_ASSIGNED]:    'ti-ticket',
  [NotificationType.TICKET_UPDATED]:     'ti-edit',
}

const TYPE_COLOR: Record<NotificationType, string> = {
  [NotificationType.TASK_ASSIGNED]:       'text-gd bg-gn',
  [NotificationType.TASK_OVERDUE]:        'text-red-500 bg-red-50',
  [NotificationType.TASK_DUE_SOON]:       'text-yellow-600 bg-yellow-50',
  [NotificationType.IMPEDIMENT_CREATED]:  'text-red-500 bg-red-50',
  [NotificationType.IMPEDIMENT_ESCALATED]:'text-orange-600 bg-orange-50',
  [NotificationType.IMPEDIMENT_RESOLVED]: 'text-green-600 bg-green-50',
  [NotificationType.PHASE_UNLOCKED]:      'text-gd bg-gn',
  [NotificationType.PHASE_COMPLETED]:     'text-green-600 bg-green-50',
  [NotificationType.MENTION]:             'text-purple-600 bg-purple-50',
  [NotificationType.MEETING_REMINDER]:    'text-blue-600 bg-blue-50',
  [NotificationType.CHECKIN_REQUEST]:     'text-gx bg-page-bg',
  [NotificationType.GOAL_AT_RISK]:        'text-red-500 bg-red-50',
  [NotificationType.TRANSCRIPT_READY]:    'text-indigo-600 bg-indigo-50',
  [NotificationType.TICKET_ASSIGNED]:     'text-cyan-600 bg-cyan-50',
  [NotificationType.TICKET_UPDATED]:      'text-cyan-600 bg-cyan-50',
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `${minutes}min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

function NotificationItem({
  notification,
  onMarkRead,
}: {
  notification: Notification
  onMarkRead: (id: string) => void
}) {
  const icon = TYPE_ICON[notification.type] ?? 'ti-bell'
  const color = TYPE_COLOR[notification.type] ?? 'text-gx bg-page-bg'

  return (
    <button
      onClick={() => !notification.isRead && onMarkRead(notification.id)}
      className={clsx(
        'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-page-bg',
        !notification.isRead && 'bg-blue-50/40',
      )}
    >
      <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5', color)}>
        <i className={clsx('ti', icon, 'text-sm')} aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={clsx('text-sm leading-snug', notification.isRead ? 'text-gray-600' : 'font-semibold text-gray-800')}>
          {notification.title}
        </p>
        <p className="text-xs text-gx mt-0.5 line-clamp-2">{notification.body}</p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="text-[10px] text-gx whitespace-nowrap">{timeAgo(notification.createdAt)}</span>
        {!notification.isRead && (
          <span className="w-2 h-2 rounded-full bg-gd" aria-label="Não lida" />
        )}
      </div>
    </button>
  )
}

interface NotificationPanelProps {
  onClose: () => void
}

export function NotificationPanel({ onClose }: NotificationPanelProps) {
  const { notifications, isLoading, markRead, markAllRead } = useNotifications()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  const unread = notifications.filter((n) => !n.isRead)

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-1 w-80 bg-white border border-gs rounded-2xl shadow-xl z-50 overflow-hidden"
      role="dialog"
      aria-label="Notificações"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gs/60">
        <h2 className="text-sm font-semibold text-gray-800 font-sora">Notificações</h2>
        {unread.length > 0 && (
          <button
            onClick={() => markAllRead()}
            className="text-xs text-gm hover:text-gd font-medium transition-colors"
          >
            Marcar todas como lidas
          </button>
        )}
      </div>

      {/* Content */}
      <div className="max-h-[420px] overflow-y-auto divide-y divide-gs/40">
        {isLoading && (
          <div className="flex items-center justify-center py-10">
            <span className="text-xs text-gx">Carregando…</span>
          </div>
        )}
        {!isLoading && notifications.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <i className="ti ti-bell-off text-2xl text-gx" aria-hidden="true" />
            <p className="text-xs text-gx">Nenhuma notificação</p>
          </div>
        )}
        {notifications.map((n) => (
          <NotificationItem key={n.id} notification={n} onMarkRead={markRead} />
        ))}
      </div>
    </div>
  )
}
