import { DomainEvent } from '../../../shared/events'
import { PlanTier, TenantStatus } from '@mediall/types'

/**
 * Tenant status/tier changes (plano 26). Published by the platform/billing
 * context so interested contexts (mail, realtime banner) can react via
 * `@OnEvent` — never call those contexts directly (architecture.md §3).
 */
export class TenantSuspendedEvent extends DomainEvent {
  readonly eventName = 'tenant.suspended'
  constructor(
    public readonly tenantId: string,
    public readonly reason: 'payment_failed' | 'manual' | 'canceled',
  ) {
    super()
  }
}

export class TenantReactivatedEvent extends DomainEvent {
  readonly eventName = 'tenant.reactivated'
  constructor(
    public readonly tenantId: string,
    public readonly status: TenantStatus,
  ) {
    super()
  }
}

export class TenantTierChangedEvent extends DomainEvent {
  readonly eventName = 'tenant.tier_changed'
  constructor(
    public readonly tenantId: string,
    public readonly fromTier: PlanTier,
    public readonly toTier: PlanTier,
  ) {
    super()
  }
}
