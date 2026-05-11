import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { AccessScope, JwtPayload } from '@mediall/types'

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  private summaryCache = new Map<string, { data: unknown; expiresAt: number }>()

  private cacheKey(user: JwtPayload): string {
    return `${user.accessScope}:${[...user.units].sort().join(',')}`
  }

  async getSummary(user: JwtPayload) {
    const key = this.cacheKey(user)
    const cached = this.summaryCache.get(key)
    if (cached && cached.expiresAt > Date.now()) return cached.data

    const result = await this.computeSummary(user)
    this.summaryCache.set(key, { data: result, expiresAt: Date.now() + 30_000 })
    return result
  }

  private async computeSummary(user: JwtPayload) {
    const isGlobal = user.accessScope === AccessScope.GLOBAL
    const unitFilter = isGlobal ? {} : { unitId: { in: user.units } }

    const [totalPlans, openImpediments, blockedTasks, overdueTasks, completedTasks, goalsAtRisk, plans, impediments, units] =
      await Promise.all([
        this.prisma.strategicPlan.count({ where: { ...unitFilter, status: 'ACTIVE' } }),

        this.prisma.taskImpediment.count({ where: { ...unitFilter, status: { not: 'RESOLVED' } } }),

        this.prisma.task.count({ where: { ...unitFilter, isBlocked: true } }),

        this.prisma.task.count({
          where: { ...unitFilter, dueDate: { lt: new Date() }, completedAt: null },
        }),

        this.prisma.task.count({ where: { ...unitFilter, completedAt: { not: null } } }),

        this.prisma.goal.count({ where: { ...unitFilter, status: 'AT_RISK' } }),

        this.prisma.strategicPlan.findMany({
          where: { ...unitFilter, status: 'ACTIVE' },
          include: {
            unit: { select: { id: true, name: true } },
            objectives: { select: { progressPct: true, trafficLight: true } },
          },
          orderBy: { createdAt: 'desc' },
        }),

        this.prisma.taskImpediment.findMany({
          where: { ...unitFilter, status: { not: 'RESOLVED' } },
          include: { task: { select: { id: true, title: true } } },
          orderBy: [{ escalationLevel: 'desc' }, { createdAt: 'asc' }],
          take: 10,
        }),

        this.prisma.unit.findMany({
          where: {
            isActive: true,
            ...(isGlobal ? {} : { id: { in: user.units } }),
          },
          select: { id: true, name: true, type: true },
        }),
      ])

    const plansWithMetrics = plans.map((plan) => {
      const progress = plan.objectives.length
        ? Math.round(plan.objectives.reduce((sum, o) => sum + Number(o.progressPct), 0) / plan.objectives.length)
        : 0
      const hasRed = plan.objectives.some((o) => o.trafficLight === 'RED')
      const hasYellow = plan.objectives.some((o) => o.trafficLight === 'YELLOW')
      return {
        id: plan.id,
        name: plan.name,
        year: plan.year,
        unitId: plan.unitId,
        unitName: plan.unit.name,
        progress,
        trafficLight: hasRed ? 'RED' : hasYellow ? 'YELLOW' : 'GREEN',
      }
    })

    const unitsWithMetrics = units.map((unit) => {
      const unitPlans = plansWithMetrics.filter((p) => p.unitId === unit.id)
      const unitImps = impediments.filter((i) => i.unitId === unit.id)
      const hasRed =
        unitPlans.some((p) => p.trafficLight === 'RED') || unitImps.some((i) => i.escalationLevel >= 2)
      const hasYellow =
        unitPlans.some((p) => p.trafficLight === 'YELLOW') || unitImps.some((i) => i.escalationLevel >= 1)
      const progress =
        unitPlans.length
          ? Math.round(unitPlans.reduce((sum, p) => sum + p.progress, 0) / unitPlans.length)
          : 0
      return {
        id: unit.id,
        name: unit.name,
        type: unit.type,
        status: hasRed ? 'RED' : hasYellow ? 'YELLOW' : 'GREEN',
        progress,
        plans: unitPlans.length,
        impediments: unitImps.length,
      }
    })

    return {
      metrics: {
        totalPlans,
        openImpediments,
        blockedTasks,
        overdueTasks,
        completedTasks,
        goalsAtRisk,
      },
      units: unitsWithMetrics,
      plans: plansWithMetrics,
      impediments: impediments.map((i) => ({
        id: i.id,
        description: i.description,
        unitId: i.unitId,
        escalationLevel: i.escalationLevel,
        daysOpen: Math.floor((Date.now() - i.createdAt.getTime()) / 86_400_000),
        taskId: i.task.id,
        taskTitle: i.task.title,
        responsibleForResolution: i.responsibleForResolution,
      })),
    }
  }
}
