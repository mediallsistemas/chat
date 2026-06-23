import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { AccessScope, JwtPayload } from '@mediall/types'

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  private summaryCache = new Map<string, { data: unknown; expiresAt: number }>()
  private trendsCache = new Map<string, { data: unknown; expiresAt: number }>()

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
        this.prisma.strategicPlan.count({
          where: {
            status: 'ACTIVE',
            deletedAt: null,
            ...(isGlobal ? {} : { units: { some: { unitId: { in: user.units } } } }),
          },
        }),

        this.prisma.taskImpediment.count({ where: { ...unitFilter, status: { not: 'RESOLVED' } } }),

        this.prisma.task.count({ where: { ...unitFilter, isBlocked: true } }),

        this.prisma.task.count({
          where: { ...unitFilter, dueDate: { lt: new Date() }, completedAt: null },
        }),

        this.prisma.task.count({ where: { ...unitFilter, completedAt: { not: null } } }),

        this.prisma.goal.count({ where: { ...unitFilter, status: 'AT_RISK' } }),

        this.prisma.strategicPlan.findMany({
          where: {
            status: 'ACTIVE',
            deletedAt: null,
            ...(isGlobal ? {} : { units: { some: { unitId: { in: user.units } } } }),
          },
          include: {
            unit: { select: { id: true, name: true } },
            objectives: { select: { progressPct: true, trafficLight: true } },
            // Plano 24/25 — unidades onde o plano vale (breakdown por unidade no painel)
            units: { select: { unitId: true, unit: { select: { name: true } } } },
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
        attachedUnits: plan.units.map((pu) => ({ id: pu.unitId, name: pu.unit.name })),
        progress,
        trafficLight: hasRed ? 'RED' : hasYellow ? 'YELLOW' : 'GREEN',
      }
    })

    const unitsWithMetrics = units.map((unit) => {
      const unitPlans = plansWithMetrics.filter((p) => p.attachedUnits.some((au) => au.id === unit.id))
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

  // Number of weekly buckets the trend charts cover (~3 months).
  private static readonly TREND_WEEKS = 12

  /**
   * Time-series for the dashboard charts (plano 25 — Slice 2/3). All series are
   * scoped like the summary (GLOBAL sees all; others only `user.units`) and ride
   * the tenant auto-scope ($use). Cached 60s per scope key.
   *
   * - completion / impediments: derived from existing timestamps (no schema
   *   change) — honest history available immediately.
   * - planProgress: from PlanProgressSnapshot, which only accumulates from the
   *   day the snapshot job first runs (empty until then — the UI handles that).
   */
  async getTrends(user: JwtPayload) {
    const key = this.cacheKey(user)
    const cached = this.trendsCache.get(key)
    if (cached && cached.expiresAt > Date.now()) return cached.data

    const result = await this.computeTrends(user)
    this.trendsCache.set(key, { data: result, expiresAt: Date.now() + 60_000 })
    return result
  }

  private async computeTrends(user: JwtPayload) {
    const isGlobal = user.accessScope === AccessScope.GLOBAL
    const unitFilter = isGlobal ? {} : { unitId: { in: user.units } }

    const weeks = this.lastNWeeks(DashboardService.TREND_WEEKS)
    const since = new Date(`${weeks[0]}T00:00:00.000Z`)
    const weekIndex = new Map(weeks.map((w, i) => [w, i]))

    const [completedTasks, impediments, snapshotRows] = await Promise.all([
      this.prisma.task.findMany({
        where: { ...unitFilter, completedAt: { gte: since } },
        select: { completedAt: true },
      }),

      this.prisma.taskImpediment.findMany({
        where: {
          ...unitFilter,
          OR: [{ createdAt: { gte: since } }, { resolvedAt: { gte: since } }],
        },
        select: { createdAt: true, resolvedAt: true },
      }),

      this.prisma.planProgressSnapshot.groupBy({
        by: ['capturedOn'],
        where: {
          capturedOn: { gte: since },
          ...(isGlobal ? {} : { plan: { units: { some: { unitId: { in: user.units } } } } }),
        },
        _avg: { progressPct: true },
        orderBy: { capturedOn: 'asc' },
      }),
    ])

    const completion = new Array(weeks.length).fill(0)
    for (const t of completedTasks) {
      if (!t.completedAt) continue
      const i = weekIndex.get(this.weekStart(t.completedAt))
      if (i !== undefined) completion[i] += 1
    }

    const opened = new Array(weeks.length).fill(0)
    const resolved = new Array(weeks.length).fill(0)
    for (const imp of impediments) {
      const oi = weekIndex.get(this.weekStart(imp.createdAt))
      if (oi !== undefined) opened[oi] += 1
      if (imp.resolvedAt) {
        const ri = weekIndex.get(this.weekStart(imp.resolvedAt))
        if (ri !== undefined) resolved[ri] += 1
      }
    }

    const planProgress = snapshotRows.map((r) => ({
      date: r.capturedOn.toISOString().slice(0, 10),
      avgProgress: Math.round(Number(r._avg.progressPct ?? 0)),
    }))

    return {
      weeks,
      completion,
      impedimentsOpened: opened,
      impedimentsResolved: resolved,
      planProgress,
    }
  }

  /** ISO date (YYYY-MM-DD) of the Monday starting the week that contains `d` (UTC). */
  private weekStart(d: Date): string {
    const x = new Date(d)
    x.setUTCHours(0, 0, 0, 0)
    const day = x.getUTCDay() // 0=Sun..6=Sat
    x.setUTCDate(x.getUTCDate() + (day === 0 ? -6 : 1 - day))
    return x.toISOString().slice(0, 10)
  }

  /** The last `n` week-start dates (Mondays, UTC), oldest first, including this week. */
  private lastNWeeks(n: number): string[] {
    const monday = new Date()
    monday.setUTCHours(0, 0, 0, 0)
    const day = monday.getUTCDay()
    monday.setUTCDate(monday.getUTCDate() + (day === 0 ? -6 : 1 - day))
    const weeks: string[] = []
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(monday)
      d.setUTCDate(d.getUTCDate() - i * 7)
      weeks.push(d.toISOString().slice(0, 10))
    }
    return weeks
  }
}
