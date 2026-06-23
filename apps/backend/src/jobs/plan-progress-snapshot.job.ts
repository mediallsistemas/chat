import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { TrafficLight } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'

/**
 * Plano 25 (Slice 3) — daily snapshot of each active plan's computed progress,
 * so the dashboard can chart progress evolution over time (no history existed
 * before this job; progress is otherwise only ever computed live).
 *
 * Runs in cron context (no tenant in AsyncLocalStorage) → the PrismaService
 * `$use` tenant middleware is inert here, so this reads plans across ALL tenants
 * and stamps each snapshot with the plan's own `tenantId` explicitly. The upsert
 * is idempotent per (plan, day): re-running the job the same day overwrites the
 * day's value instead of duplicating it.
 */
@Injectable()
export class PlanProgressSnapshotJob {
  private readonly logger = new Logger(PlanProgressSnapshotJob.name)

  constructor(private prisma: PrismaService) {}

  // Daily at 00:05 — captures yesterday's end-of-day state for the new UTC day.
  @Cron('5 0 * * *')
  async snapshot() {
    this.logger.log('Plan progress snapshot job started')
    try {
      const capturedOn = new Date()
      capturedOn.setUTCHours(0, 0, 0, 0)

      const plans = await this.prisma.strategicPlan.findMany({
        where: { status: 'ACTIVE', deletedAt: null },
        select: {
          id: true,
          tenantId: true,
          unitId: true,
          objectives: { select: { progressPct: true, trafficLight: true } },
        },
      })

      for (const plan of plans) {
        const progressPct = plan.objectives.length
          ? Math.round(
              plan.objectives.reduce((sum, o) => sum + Number(o.progressPct), 0) /
                plan.objectives.length,
            )
          : 0
        const trafficLight = plan.objectives.some((o) => o.trafficLight === 'RED')
          ? TrafficLight.RED
          : plan.objectives.some((o) => o.trafficLight === 'YELLOW')
            ? TrafficLight.YELLOW
            : TrafficLight.GREEN

        await this.prisma.planProgressSnapshot.upsert({
          where: { planId_capturedOn: { planId: plan.id, capturedOn } },
          create: {
            tenantId: plan.tenantId,
            planId: plan.id,
            unitId: plan.unitId,
            progressPct,
            trafficLight,
            capturedOn,
          },
          update: { progressPct, trafficLight },
        })
      }

      this.logger.log(`Plan progress snapshot job completed (${plans.length} plans)`)
    } catch (err) {
      this.logger.error('Plan progress snapshot job failed', (err as Error).stack)
    }
  }
}
