import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { EventBusService } from '../../../shared/events'
import { getCurrentTenantId } from '../../../shared/tenant/tenant-context'
import {
  PlanTier,
  SubscriptionStatus,
  SubscriptionView,
  TenantStatus,
  TIER_LIMITS,
} from '@mediall/types'
import {
  TenantReactivatedEvent,
  TenantSuspendedEvent,
} from '../events/tenant-status.events'

/**
 * Billing reconciliation (plano 26.3) + the tenant's own subscription view (26.6).
 *
 * The webhook is the source of truth for status (riscos §1): we never trust the
 * checkout return. Each Stripe event is recorded in `billing_events` keyed by
 * `providerEventId` for idempotency (Stripe re-sends), then mapped onto the
 * `Subscription` and the gating `Tenant.status`.
 *
 * Billing tables are platform-scoped (not in TENANT_MODELS), and webhooks run
 * with no tenant context, so all reads/writes here are intentionally unscoped —
 * we resolve the tenant explicitly from the event.
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name)

  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
  ) {}

  /** Tenant-facing: the current tenant's subscription + plan limits + usage (26.6). */
  async getCurrentSubscriptionView(): Promise<SubscriptionView> {
    const tenantId = getCurrentTenantId()
    if (!tenantId) throw new NotFoundException('Organização não identificada.')

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } })
    if (!tenant) throw new NotFoundException('Organização não encontrada.')

    const subscription = await this.prisma.subscription.findUnique({ where: { tenantId } })

    const [units, users] = await Promise.all([
      this.prisma.unit.count({ where: { tenantId } }),
      this.prisma.user.count({ where: { tenantId } }),
    ])

    const tier = (subscription?.tier ?? tenant.planTier) as PlanTier
    return {
      tier,
      status: (subscription?.status ?? SubscriptionStatus.TRIALING) as SubscriptionStatus,
      tenantStatus: tenant.status as TenantStatus,
      currentPeriodEnd: subscription?.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
      trialEndsAt: tenant.trialEndsAt?.toISOString() ?? null,
      limits: TIER_LIMITS[tier],
      usage: { units, users },
    }
  }

  /**
   * Webhook reconciliation (26.3). Returns `{ duplicate: true }` if the event was
   * already processed (idempotency), else applies it. `event` is a verified
   * Stripe.Event (loosely typed — the SDK isn't a compile-time dependency).
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async processWebhookEvent(event: any): Promise<{ duplicate: boolean; handled: boolean }> {
    const providerEventId: string = event.id
    const type: string = event.type

    const already = await this.prisma.billingEvent.findUnique({ where: { providerEventId } })
    if (already) return { duplicate: true, handled: false }

    const obj = event.data?.object ?? {}
    const tenantId = await this.resolveTenantId(obj)

    let handled = true
    switch (type) {
      case 'invoice.paid':
      case 'invoice.payment_succeeded':
        await this.applyActive(tenantId, obj)
        break
      case 'invoice.payment_failed':
        await this.applyStatus(tenantId, SubscriptionStatus.PAST_DUE, TenantStatus.PAST_DUE)
        break
      case 'customer.subscription.updated':
        await this.applySubscriptionUpdate(tenantId, obj)
        break
      case 'customer.subscription.deleted':
        await this.applyStatus(tenantId, SubscriptionStatus.CANCELED, TenantStatus.SUSPENDED)
        if (tenantId) this.eventBus.publish(new TenantSuspendedEvent(tenantId, 'canceled'))
        break
      default:
        handled = false // recorded for audit, no state change
    }

    await this.prisma.billingEvent.create({
      data: { providerEventId, tenantId, type, payload: event },
    })

    return { duplicate: false, handled }
  }

  /** Resolve the tenant from an event object: metadata → subscription → customer. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async resolveTenantId(obj: any): Promise<string | null> {
    if (obj?.metadata?.tenantId) return obj.metadata.tenantId

    const subId: string | undefined =
      typeof obj?.subscription === 'string' ? obj.subscription : obj?.id
    if (subId) {
      const sub = await this.prisma.subscription.findFirst({ where: { providerSubId: subId } })
      if (sub) return sub.tenantId
    }

    const customerId: string | undefined =
      typeof obj?.customer === 'string' ? obj.customer : undefined
    if (customerId) {
      const sub = await this.prisma.subscription.findFirst({
        where: { providerCustomerId: customerId },
      })
      if (sub) return sub.tenantId
    }

    return null
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async applyActive(tenantId: string | null, obj: any): Promise<void> {
    if (!tenantId) return
    const periodEnd = this.toDate(obj?.lines?.data?.[0]?.period?.end ?? obj?.current_period_end)
    await this.prisma.subscription.updateMany({
      where: { tenantId },
      data: {
        status: SubscriptionStatus.ACTIVE,
        ...(periodEnd ? { currentPeriodEnd: periodEnd } : {}),
      },
    })
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { status: TenantStatus.ACTIVE },
    })
    this.eventBus.publish(new TenantReactivatedEvent(tenantId, TenantStatus.ACTIVE))
  }

  private async applyStatus(
    tenantId: string | null,
    subStatus: SubscriptionStatus,
    tenantStatus: TenantStatus,
  ): Promise<void> {
    if (!tenantId) return
    await this.prisma.subscription.updateMany({ where: { tenantId }, data: { status: subStatus } })
    await this.prisma.tenant.update({ where: { id: tenantId }, data: { status: tenantStatus } })
    if (tenantStatus === TenantStatus.SUSPENDED) {
      this.eventBus.publish(new TenantSuspendedEvent(tenantId, 'payment_failed'))
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async applySubscriptionUpdate(tenantId: string | null, obj: any): Promise<void> {
    if (!tenantId) return
    const periodEnd = this.toDate(obj?.current_period_end)
    await this.prisma.subscription.updateMany({
      where: { tenantId },
      data: {
        status: this.mapStripeStatus(obj?.status),
        cancelAtPeriodEnd: Boolean(obj?.cancel_at_period_end),
        ...(periodEnd ? { currentPeriodEnd: periodEnd } : {}),
      },
    })
  }

  /** Stripe subscription.status → our SubscriptionStatus. */
  private mapStripeStatus(status?: string): SubscriptionStatus {
    switch (status) {
      case 'active':
        return SubscriptionStatus.ACTIVE
      case 'past_due':
      case 'unpaid':
        return SubscriptionStatus.PAST_DUE
      case 'canceled':
      case 'incomplete_expired':
        return SubscriptionStatus.CANCELED
      case 'trialing':
      default:
        return SubscriptionStatus.TRIALING
    }
  }

  private toDate(unixSeconds?: number): Date | null {
    return typeof unixSeconds === 'number' ? new Date(unixSeconds * 1000) : null
  }
}
