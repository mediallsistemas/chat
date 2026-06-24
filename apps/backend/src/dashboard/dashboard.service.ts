import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { AccessScope, JwtPayload } from '@mediall/types'

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  private summaryCache = new Map<string, { data: unknown; expiresAt: number }>()
  private trendsCache = new Map<string, { data: unknown; expiresAt: number }>()
  private unitCache = new Map<string, { data: unknown; expiresAt: number }>()

  private cacheKey(user: JwtPayload): string {
    return `${user.accessScope}:${[...user.units].sort().join(',')}`
  }

  /**
   * The dashboard controller is not a `BaseUnitController`, so a `:unitId`/`?unitId`
   * does not pass through `UnitScopeGuard`. Validate access here (security.md §5):
   * GLOBAL sees any unit (within its tenant, enforced by the $use middleware);
   * everyone else must have the unit in their token's `units[]`.
   */
  private assertUnitAccess(user: JwtPayload, unitId: string): void {
    if (user.accessScope === AccessScope.GLOBAL) return
    if (!user.units.includes(unitId)) {
      throw new ForbiddenException('Você não tem acesso a esta unidade.')
    }
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

    // Group activity per unit (Integração 5 — plano 22.6): where is team
    // collaboration alive vs. quiet. Active team groups (non-archived, non-DM)
    // and messages posted in the last 7 days, aggregated per unit. Explicit
    // cross-unit aggregation, scoped to the units the user already sees above
    // (security.md §5 — GLOBAL sees all, others only their units).
    const unitIds = units.map((u) => u.id)
    const cutoff = new Date(Date.now() - 7 * 86_400_000)
    const activityRows =
      unitIds.length > 0
        ? await this.prisma.$queryRaw<
            { unit_id: string; active_groups: bigint; messages: bigint }[]
          >`
            SELECT g.unit_id,
                   COUNT(DISTINCT g.id) AS active_groups,
                   COUNT(m.id) FILTER (
                     WHERE m.created_at >= ${cutoff}
                       AND m.is_deleted = false
                       AND m.type <> 'SYSTEM'
                   ) AS messages
            FROM chat_groups g
            LEFT JOIN chat_messages m ON m.group_id = g.id
            WHERE g.is_archived = false
              AND g.type <> 'PRIVATE'
              AND g.unit_id IN (${Prisma.join(unitIds)})
            GROUP BY g.unit_id
          `
        : []
    const activityByUnit = new Map(activityRows.map((r) => [r.unit_id, r]))
    const groupActivity = unitsWithMetrics
      .map((u) => ({
        unitId: u.id,
        unitName: u.name,
        activeGroups: Number(activityByUnit.get(u.id)?.active_groups ?? 0),
        messages: Number(activityByUnit.get(u.id)?.messages ?? 0),
      }))
      .sort((a, b) => b.messages - a.messages)

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
      groupActivity,
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

  /**
   * Single-unit detail for the scope-aware dashboard (header "uma unidade").
   * Metrics, active plans (with this unit's objectives) and open impediments,
   * all scoped to `unitId`. Cached 30s per unit.
   */
  async getUnitDetail(user: JwtPayload, unitId: string) {
    this.assertUnitAccess(user, unitId)

    const cached = this.unitCache.get(unitId)
    if (cached && cached.expiresAt > Date.now()) return cached.data

    const result = await this.computeUnitDetail(unitId)
    this.unitCache.set(unitId, { data: result, expiresAt: Date.now() + 30_000 })
    return result
  }

  private async computeUnitDetail(unitId: string) {
    const now = new Date()
    const [unit, plans, impediments, totalTasks, overdueTasks, openImpediments] = await Promise.all([
      this.prisma.unit.findUnique({
        where: { id: unitId },
        select: { id: true, name: true, type: true, manager: { select: { id: true, name: true } } },
      }),

      this.prisma.strategicPlan.findMany({
        where: { status: 'ACTIVE', deletedAt: null, units: { some: { unitId } } },
        include: {
          // Objectives carry their own unitId (per-unit execution, plano 24) — only
          // this unit's objectives, matching the objectives service scoping.
          objectives: {
            where: { unitId },
            select: { id: true, title: true, progressPct: true, trafficLight: true },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),

      this.prisma.taskImpediment.findMany({
        where: { unitId, status: { not: 'RESOLVED' } },
        include: { task: { select: { id: true, title: true } } },
        orderBy: [{ escalationLevel: 'desc' }, { createdAt: 'asc' }],
      }),

      this.prisma.task.count({ where: { unitId } }),
      this.prisma.task.count({ where: { unitId, dueDate: { lt: now }, completedAt: null } }),
      this.prisma.taskImpediment.count({ where: { unitId, status: { not: 'RESOLVED' } } }),
    ])

    if (!unit) throw new NotFoundException('Unidade não encontrada.')

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
        progress,
        trafficLight: hasRed ? 'RED' : hasYellow ? 'YELLOW' : 'GREEN',
        objectives: plan.objectives.map((o) => ({
          id: o.id,
          title: o.title,
          progressPct: Number(o.progressPct),
          trafficLight: o.trafficLight,
        })),
      }
    })

    return {
      unit: { id: unit.id, name: unit.name, type: unit.type, manager: unit.manager },
      plans: plansWithMetrics,
      impediments: impediments.map((i) => ({
        id: i.id,
        description: i.description,
        escalationLevel: i.escalationLevel,
        daysOpen: Math.floor((Date.now() - i.createdAt.getTime()) / 86_400_000),
        taskId: i.task.id,
        taskTitle: i.task.title,
      })),
      metrics: {
        totalTasks,
        overdueTasks,
        openImpediments,
        activePlans: plansWithMetrics.length,
      },
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
  async getTrends(user: JwtPayload, unitId?: string) {
    if (unitId) this.assertUnitAccess(user, unitId)

    const key = `${this.cacheKey(user)}:${unitId ?? 'all'}`
    const cached = this.trendsCache.get(key)
    if (cached && cached.expiresAt > Date.now()) return cached.data

    const result = await this.computeTrends(user, unitId)
    this.trendsCache.set(key, { data: result, expiresAt: Date.now() + 60_000 })
    return result
  }

  private async computeTrends(user: JwtPayload, unitId?: string) {
    const isGlobal = user.accessScope === AccessScope.GLOBAL
    // A single selected unit narrows everything to that unit; otherwise scope to
    // the user's units (GLOBAL sees all). Access already validated in getTrends.
    const unitFilter = unitId ? { unitId } : isGlobal ? {} : { unitId: { in: user.units } }
    const snapshotPlanFilter = unitId
      ? { plan: { units: { some: { unitId } } } }
      : isGlobal
        ? {}
        : { plan: { units: { some: { unitId: { in: user.units } } } } }

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
          ...snapshotPlanFilter,
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
