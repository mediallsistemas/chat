import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { JwtPayload, ImpedimentStatus } from '@mediall/types'

const UPCOMING_MEETINGS_WINDOW_HOURS = 48
const UPCOMING_MEETINGS_LIMIT = 5
const UNREAD_GROUPS_LIMIT = 8
const WEEK_TASKS_DAYS = 7

@Injectable()
export class MeService {
  constructor(private prisma: PrismaService) {}

  async getDashboard(unitId: string, user: JwtPayload) {
    const now = new Date()
    const endOfToday = new Date(now)
    endOfToday.setHours(23, 59, 59, 999)
    const meetingWindow = new Date(now.getTime() + UPCOMING_MEETINGS_WINDOW_HOURS * 60 * 60 * 1000)
    const weekEnd = new Date(now.getTime() + WEEK_TASKS_DAYS * 24 * 60 * 60 * 1000)

    const [todayTasks, weekTasks, myImpediments, upcomingMeetings, unreadGroups] = await Promise.all([
      // Tasks that need attention today: due today or earlier OR is blocked,
      // and not yet completed.
      this.prisma.task.findMany({
        where: {
          unitId,
          responsibleUserId: user.sub,
          completedAt: null,
          OR: [
            { dueDate: { lte: endOfToday } },
            { isBlocked: true },
          ],
        },
        select: this.taskSelect,
        orderBy: [{ isBlocked: 'desc' }, { dueDate: 'asc' }],
        take: 20,
      }),

      // Week ahead (excluding what already showed in today's bucket).
      this.prisma.task.findMany({
        where: {
          unitId,
          responsibleUserId: user.sub,
          completedAt: null,
          isBlocked: false,
          dueDate: { gt: endOfToday, lte: weekEnd },
        },
        select: this.taskSelect,
        orderBy: { dueDate: 'asc' },
        take: 20,
      }),

      // Impediments where I am the responsible for resolution.
      this.prisma.taskImpediment.findMany({
        where: {
          unitId,
          responsibleForResolution: user.sub,
          status: { in: [ImpedimentStatus.BLOCKED, ImpedimentStatus.ATTENTION] },
        },
        select: {
          id: true,
          taskId: true,
          description: true,
          status: true,
          escalationLevel: true,
          expectedResolutionDate: true,
          createdAt: true,
          task: { select: { id: true, title: true } },
        },
        orderBy: [{ escalationLevel: 'desc' }, { expectedResolutionDate: 'asc' }],
        take: 10,
      }),

      // Meetings I'm invited to in the next 48h.
      this.prisma.meeting.findMany({
        where: {
          unitId,
          status: 'SCHEDULED',
          startAt: { gte: now, lte: meetingWindow },
          participants: { some: { userId: user.sub } },
        },
        select: {
          id: true,
          title: true,
          startAt: true,
          endAt: true,
          roomId: true,
        },
        orderBy: { startAt: 'asc' },
        take: UPCOMING_MEETINGS_LIMIT,
      }),

      this.findUnreadGroups(unitId, user.sub),
    ])

    return {
      todayTasks,
      weekTasks,
      myImpediments,
      upcomingMeetings,
      unreadGroups,
    }
  }

  private taskSelect = {
    id: true,
    title: true,
    description: true,
    boardId: true,
    columnId: true,
    priority: true,
    dueDate: true,
    isBlocked: true,
    acceptanceStatus: true,
    completedAt: true,
    column: { select: { id: true, name: true, isDoneColumn: true } },
    board: { select: { id: true, name: true } },
  } as const

  /**
   * Returns groups where the user is a member and the last message
   * happened after their lastReadAt (so there's something to read).
   */
  private async findUnreadGroups(unitId: string, userId: string) {
    const memberships = await this.prisma.groupMember.findMany({
      where: {
        userId,
        group: { unitId, isArchived: false },
      },
      select: {
        groupId: true,
        lastReadAt: true,
        group: {
          select: {
            id: true,
            name: true,
            type: true,
            avatarUrl: true,
          },
        },
      },
    })

    const result = await Promise.all(
      memberships.map(async (m) => {
        const lastMessage = await this.prisma.message.findFirst({
          where: { groupId: m.groupId, isDeleted: false },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            content: true,
            createdAt: true,
            sender: { select: { id: true, name: true } },
          },
        })

        if (!lastMessage) return null

        const cutoff = m.lastReadAt ?? new Date(0)
        if (lastMessage.createdAt <= cutoff) return null

        const unreadCount = await this.prisma.message.count({
          where: {
            groupId: m.groupId,
            isDeleted: false,
            createdAt: { gt: cutoff },
            // Don't count my own messages as "unread" for me.
            senderId: { not: userId },
          },
        })

        if (unreadCount === 0) return null

        return {
          group: m.group,
          unreadCount,
          lastMessage,
        }
      }),
    )

    return result
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) =>
        b.lastMessage.createdAt.getTime() - a.lastMessage.createdAt.getTime(),
      )
      .slice(0, UNREAD_GROUPS_LIMIT)
  }
}
