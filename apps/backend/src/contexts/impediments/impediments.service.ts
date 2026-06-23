import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { EventBusService } from '../../shared/events'
import { ImpedimentCreatedEvent } from './events/impediment-created.event'
import { ImpedimentEscalatedEvent } from './events/impediment-escalated.event'
import { ImpedimentResolvedEvent } from './events/impediment-resolved.event'
import { CreateImpedimentDto, ResolveImpedimentDto } from './dto/create-impediment.dto'
import { JwtPayload, ImpedimentStatus } from '@mediall/types'

@Injectable()
export class ImpedimentsService {
  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
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
      this.eventBus.publish(
        new ImpedimentCreatedEvent(
          impediment.id,
          taskId,
          task?.title ?? taskId,
          unitId,
          dto.responsibleForResolution,
        ),
      )
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

    this.eventBus.publish(
      new ImpedimentResolvedEvent(impedimentId, impediment.taskId, unitId, user.sub),
    )

    return resolved
  }

  /**
   * Manually escalate an impediment one level (0→1→2), bypassing the day-based
   * wait of the daily job (plano 25.5 — inline action). Publishing
   * `ImpedimentEscalatedEvent` reuses the whole chain: manager notifications,
   * the dashboard refresh, and the "war-room" notice posted into the impeded
   * task's chat group (plano 22). Caps at level 2 (Diretoria).
   */
  async escalate(unitId: string, impedimentId: string) {
    const impediment = await this.prisma.taskImpediment.findFirst({
      where: { id: impedimentId, unitId },
    })
    if (!impediment) throw new NotFoundException('Impedimento não encontrado.')
    if (impediment.status === ImpedimentStatus.RESOLVED) {
      throw new BadRequestException('Impedimento já foi resolvido.')
    }
    if (impediment.escalationLevel >= 2) {
      throw new BadRequestException('Impedimento já está no nível máximo (Diretoria).')
    }

    const newLevel = impediment.escalationLevel + 1
    const escalated = await this.prisma.taskImpediment.update({
      where: { id: impedimentId },
      data: { escalationLevel: newLevel },
    })

    this.eventBus.publish(
      new ImpedimentEscalatedEvent(
        impedimentId,
        impediment.taskId,
        unitId,
        newLevel,
        impediment.responsibleForResolution,
      ),
    )

    return escalated
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

    const toLevel1 = await this.prisma.taskImpediment.findMany({
      where: { status: ImpedimentStatus.BLOCKED, escalationLevel: 0, createdAt: { lte: twoDaysAgo } },
      select: { id: true, taskId: true, unitId: true, responsibleForResolution: true },
    })

    const toLevel2 = await this.prisma.taskImpediment.findMany({
      where: { status: ImpedimentStatus.BLOCKED, escalationLevel: 1, createdAt: { lte: fiveDaysAgo } },
      select: { id: true, taskId: true, unitId: true, responsibleForResolution: true },
    })

    if (toLevel1.length > 0) {
      await this.prisma.taskImpediment.updateMany({
        where: { id: { in: toLevel1.map((i) => i.id) } },
        data: { escalationLevel: 1 },
      })
      toLevel1.forEach((imp) =>
        this.eventBus.publish(
          new ImpedimentEscalatedEvent(imp.id, imp.taskId, imp.unitId, 1, imp.responsibleForResolution),
        ),
      )
    }

    if (toLevel2.length > 0) {
      await this.prisma.taskImpediment.updateMany({
        where: { id: { in: toLevel2.map((i) => i.id) } },
        data: { escalationLevel: 2 },
      })
      toLevel2.forEach((imp) =>
        this.eventBus.publish(
          new ImpedimentEscalatedEvent(imp.id, imp.taskId, imp.unitId, 2, imp.responsibleForResolution),
        ),
      )
    }
  }
}
