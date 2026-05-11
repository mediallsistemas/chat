import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { NotificationsService } from '../notifications/notifications.service'
import { CreateImpedimentDto, ResolveImpedimentDto } from './dto/create-impediment.dto'
import { JwtPayload, ImpedimentStatus, NotificationType } from '@mediall/types'

@Injectable()
export class ImpedimentsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async create(unitId: string, taskId: string, dto: CreateImpedimentDto, user: JwtPayload) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId }, select: { title: true } })

    const impediment = await this.prisma.taskImpediment.create({
      data: {
        taskId,
        reportedBy: user.sub,
        description: dto.description,
        responsibleForResolution: dto.responsibleForResolution,
        expectedResolutionDate: new Date(dto.expectedResolutionDate),
        status: dto.status ?? ImpedimentStatus.BLOCKED,
        unitId,
      },
    })

    if (impediment.status === ImpedimentStatus.BLOCKED) {
      await this.prisma.task.update({ where: { id: taskId }, data: { isBlocked: true } })
    }

    if (dto.responsibleForResolution && dto.responsibleForResolution !== user.sub) {
      this.notifications
        .create({
          userId: dto.responsibleForResolution,
          unitId,
          type: NotificationType.IMPEDIMENT_CREATED,
          title: 'Novo impedimento registrado',
          body: `A tarefa "${task?.title ?? taskId}" tem um novo impedimento que requer sua atenção.`,
          entityType: 'impediment',
          entityId: impediment.id,
        })
        .catch(() => undefined)
    }

    return impediment
  }

  async resolve(unitId: string, impedimentId: string, dto: ResolveImpedimentDto, user: JwtPayload) {
    const impediment = await this.prisma.taskImpediment.findFirst({
      where: { id: impedimentId, unitId },
    })

    if (!impediment) throw new NotFoundException('Impedimento não encontrado.')
    if (impediment.status === ImpedimentStatus.RESOLVED) {
      throw new BadRequestException('Impedimento já foi resolvido.')
    }

    const resolved = await this.prisma.taskImpediment.update({
      where: { id: impedimentId },
      data: {
        status: ImpedimentStatus.RESOLVED,
        resolvedBy: user.sub,
        resolutionNotes: dto.resolutionNotes,
        resolvedAt: new Date(),
      },
    })

    const activeBlocks = await this.prisma.taskImpediment.count({
      where: { taskId: impediment.taskId, status: ImpedimentStatus.BLOCKED },
    })

    if (activeBlocks === 0) {
      await this.prisma.task.update({ where: { id: impediment.taskId }, data: { isBlocked: false } })
    }

    return resolved
  }

  async findActive(unitId: string) {
    return this.prisma.taskImpediment.findMany({
      where: { unitId, status: { not: ImpedimentStatus.RESOLVED } },
      include: {
        task: { select: { id: true, title: true, boardId: true } },
      },
      orderBy: { createdAt: 'asc' },
    })
  }

  async getAnalytics(unitId: string) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const [blocked, attention, resolvedLast30, resolvedThisWeek, all, resolved] = await Promise.all([
      this.prisma.taskImpediment.count({ where: { unitId, status: ImpedimentStatus.BLOCKED } }),
      this.prisma.taskImpediment.count({ where: { unitId, status: ImpedimentStatus.ATTENTION } }),
      this.prisma.taskImpediment.count({
        where: { unitId, status: ImpedimentStatus.RESOLVED, resolvedAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.taskImpediment.count({
        where: { unitId, status: ImpedimentStatus.RESOLVED, resolvedAt: { gte: sevenDaysAgo } },
      }),
      this.prisma.taskImpediment.findMany({
        where: { unitId, status: { not: ImpedimentStatus.RESOLVED } },
        select: { escalationLevel: true, responsibleForResolution: true },
      }),
      this.prisma.taskImpediment.findMany({
        where: { unitId, status: ImpedimentStatus.RESOLVED, resolvedAt: { not: null } },
        select: { createdAt: true, resolvedAt: true },
        take: 100,
        orderBy: { resolvedAt: 'desc' },
      }),
    ])

    const totalMs = resolved.reduce((sum, r) => {
      return sum + (r.resolvedAt!.getTime() - r.createdAt.getTime())
    }, 0)
    const avgResolutionHours = resolved.length > 0 ? Math.round(totalMs / resolved.length / 3_600_000) : 0
    const avgResolutionDays = resolved.length > 0 ? Math.round(totalMs / resolved.length / 86_400_000) : 0

    const escalationMap: Record<number, number> = { 0: 0, 1: 0, 2: 0 }
    const assigneeMap: Record<string, number> = {}
    for (const imp of all) {
      escalationMap[imp.escalationLevel] = (escalationMap[imp.escalationLevel] ?? 0) + 1
      if (imp.responsibleForResolution) {
        assigneeMap[imp.responsibleForResolution] = (assigneeMap[imp.responsibleForResolution] ?? 0) + 1
      }
    }

    const topAssigneeIds = Object.entries(assigneeMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([userId]) => userId)

    const assigneeUsers = await this.prisma.user.findMany({
      where: { id: { in: topAssigneeIds } },
      select: { id: true, name: true, avatarUrl: true },
    })

    const topAssignees = topAssigneeIds.map((id) => ({
      ...assigneeUsers.find((u) => u.id === id),
      count: assigneeMap[id],
    }))

    return {
      blocked,
      attention,
      resolvedLast30,
      resolvedThisWeek,
      avgResolutionHours,
      avgResolutionDays,
      byEscalationLevel: Object.entries(escalationMap).map(([level, count]) => ({
        level: Number(level),
        count,
      })),
      topAssignees,
    }
  }

  async escalatePending() {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)

    await this.prisma.taskImpediment.updateMany({
      where: {
        status: ImpedimentStatus.BLOCKED,
        escalationLevel: 0,
        createdAt: { lte: twoDaysAgo },
      },
      data: { escalationLevel: 1 },
    })

    await this.prisma.taskImpediment.updateMany({
      where: {
        status: ImpedimentStatus.BLOCKED,
        escalationLevel: 1,
        createdAt: { lte: fiveDaysAgo },
      },
      data: { escalationLevel: 2 },
    })
  }
}
