// Billing & multitenancy contracts (plano 26) — fonte única para back e front.
// Espelham os enums do Prisma (_enums.prisma) e os limites por tier.

/** Status comercial do tenant — o que os guards aplicam (plano 23/26). */
export enum TenantStatus {
  TRIAL = 'TRIAL',
  ACTIVE = 'ACTIVE',
  PAST_DUE = 'PAST_DUE',
  SUSPENDED = 'SUSPENDED',
  CANCELED = 'CANCELED',
}

/** Tier de assinatura. Define limites (maxUnits/maxUsers) e recursos. */
export enum PlanTier {
  STARTER = 'STARTER',
  PRO = 'PRO',
  ENTERPRISE = 'ENTERPRISE',
}

/** Status da assinatura no provedor (Stripe) — espelha o provedor. */
export enum SubscriptionStatus {
  TRIALING = 'TRIALING',
  ACTIVE = 'ACTIVE',
  PAST_DUE = 'PAST_DUE',
  CANCELED = 'CANCELED',
}

export interface TierLimits {
  /** Limite de unidades. `null` = ilimitado (ENTERPRISE). */
  maxUnits: number | null
  /** Limite de usuários. `null` = ilimitado (ENTERPRISE). */
  maxUsers: number | null
  /** Rótulo exibido ao usuário (PT). */
  label: string
}

/**
 * Limites por tier — fonte única aplicada no backend (BillingGuard / tier-limit)
 * e exibida no frontend (tela de assinatura). Ver plano 26.
 */
export const TIER_LIMITS: Record<PlanTier, TierLimits> = {
  [PlanTier.STARTER]: { maxUnits: 3, maxUsers: 25, label: 'Starter' },
  [PlanTier.PRO]: { maxUnits: 10, maxUsers: 100, label: 'Pro' },
  [PlanTier.ENTERPRISE]: { maxUnits: null, maxUsers: null, label: 'Enterprise' },
}

/** Visão da assinatura do tenant atual (tela de billing do cliente — 26.6). */
export interface SubscriptionView {
  tier: PlanTier
  status: SubscriptionStatus
  tenantStatus: TenantStatus
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  trialEndsAt: string | null
  limits: TierLimits
  usage: { units: number; users: number }
}

/** Item da lista de tenants do painel platform-admin (26.5). */
export interface PlatformTenantListItem {
  id: string
  name: string
  slug: string
  status: TenantStatus
  tier: PlanTier
  unitCount: number
  userCount: number
  subscriptionStatus: SubscriptionStatus | null
  currentPeriodEnd: string | null
  createdAt: string
}

/** Detalhe de um tenant no painel platform-admin (26.5). */
export interface PlatformTenantDetail extends PlatformTenantListItem {
  maxUnits: number
  maxUsers: number
  trialEndsAt: string | null
  providerCustomerId: string | null
  providerSubId: string | null
}
