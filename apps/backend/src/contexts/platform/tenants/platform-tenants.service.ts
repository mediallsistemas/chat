import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../../prisma/prisma.service'
import { EventBusService } from '../../../shared/events'
import { runWithoutTenant } from '../../../shared/tenant/tenant-context'
import {
  AccessScope,
  JwtPayload,
  PlanTier,
  PlatformTenantDetail,
  PlatformTenantListItem,
  TenantStatus,
  TIER_LIMITS,
  UserRole,
} from '@mediall/types'
import {
  TenantReactivatedEvent,
  TenantSuspendedEvent,
  TenantTierChangedEvent,
} from '../events/tenant-status.events'

/**
 * Platform-admin operations over ALL tenants (plano 26.5). The SaaS owner is the
 * single authorized boundary-crosser: every method runs inside `runWithoutTenant`
 * so the Prisma auto-scope middleware no-ops and we read/write across tenants
 * explicitly. Guarded by `PlatformAdminGuard` at the controller.
 */
@Injectable()
export class PlatformTenantsService {
  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
    private jwt: JwtService,
  ) {}

  async list(): Promise<PlatformTenantListItem[]> {
    return runWithoutTenant(async () => {
      const tenants = await this.prisma.tenant.findMany({
        where: { deletedAt: null },
        include: { subscription: true },
        orderBy: { createdAt: 'asc' },
      })

      // Counts per tenant (units/users) — explicit, unscoped.
      const [unitGroups, userGroups] = await Promise.all([
        this.prisma.unit.groupBy({ by: ['tenantId'], _count: { _all: true } }),
        this.prisma.user.groupBy({ by: ['tenantId'], _count: { _all: true } }),
      ])
      const unitCounts = new Map(unitGroups.map((g) => [g.tenantId, g._count._all]))
      const userCounts = new Map(userGroups.map((g) => [g.tenantId, g._count._all]))

      return tenants.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        status: t.status as TenantStatus,
        tier: t.planTier as PlanTier,
        unitCount: unitCounts.get(t.id) ?? 0,
        userCount: userCounts.get(t.id) ?? 0,
        subscriptionStatus: (t.subscription?.status as PlatformTenantListItem['subscriptionStatus']) ?? null,
        currentPeriodEnd: t.subscription?.currentPeriodEnd?.toISOString() ?? null,
        createdAt: t.createdAt.toISOString(),
      }))
    })
  }

  async detail(id: string): Promise<PlatformTenantDetail> {
    return runWithoutTenant(async () => {
      const t = await this.prisma.tenant.findUnique({
        where: { id },
        include: { subscription: true },
      })
      if (!t || t.deletedAt) throw new NotFoundException('Organização não encontrada.')

      const [unitCount, userCount] = await Promise.all([
        this.prisma.unit.count({ where: { tenantId: id } }),
        this.prisma.user.count({ where: { tenantId: id } }),
      ])

      return {
        id: t.id,
        name: t.name,
        slug: t.slug,
        status: t.status as TenantStatus,
        tier: t.planTier as PlanTier,
        unitCount,
        userCount,
        subscriptionStatus: (t.subscription?.status as PlatformTenantDetail['subscriptionStatus']) ?? null,
        currentPeriodEnd: t.subscription?.currentPeriodEnd?.toISOString() ?? null,
        createdAt: t.createdAt.toISOString(),
        maxUnits: t.maxUnits,
        maxUsers: t.maxUsers,
        trialEndsAt: t.trialEndsAt?.toISOString() ?? null,
        providerCustomerId: t.subscription?.providerCustomerId ?? null,
        providerSubId: t.subscription?.providerSubId ?? null,
      }
    })
  }

  async suspend(id: string, adminId: string): Promise<{ id: string; status: TenantStatus }> {
    return runWithoutTenant(async () => {
      await this.getTenantOrThrow(id)
      await this.prisma.tenant.update({ where: { id }, data: { status: TenantStatus.SUSPENDED } })
      await this.audit(id, adminId, 'SUSPEND_TENANT')
      this.eventBus.publish(new TenantSuspendedEvent(id, 'manual'))
      return { id, status: TenantStatus.SUSPENDED }
    })
  }

  async reactivate(id: string, adminId: string): Promise<{ id: string; status: TenantStatus }> {
    return runWithoutTenant(async () => {
      await this.getTenantOrThrow(id)
      await this.prisma.tenant.update({ where: { id }, data: { status: TenantStatus.ACTIVE } })
      await this.audit(id, adminId, 'REACTIVATE_TENANT')
      this.eventBus.publish(new TenantReactivatedEvent(id, TenantStatus.ACTIVE))
      return { id, status: TenantStatus.ACTIVE }
    })
  }

  async changeTier(id: string, tier: PlanTier, adminId: string): Promise<PlatformTenantDetail> {
    return runWithoutTenant(async () => {
      const tenant = await this.getTenantOrThrow(id)
      const limits = TIER_LIMITS[tier]

      // Downgrade guard: never delete data — block if current usage exceeds the
      // target tier's limits, with a clear message (riscos: downgrade destrutivo).
      const [unitCount, userCount] = await Promise.all([
        this.prisma.unit.count({ where: { tenantId: id } }),
        this.prisma.user.count({ where: { tenantId: id } }),
      ])
      if (limits.maxUnits !== null && unitCount > limits.maxUnits) {
        throw new ConflictException(
          `O plano ${limits.label} permite ${limits.maxUnits} unidades, mas a organização tem ${unitCount}. Remova unidades antes de baixar o plano.`,
        )
      }
      if (limits.maxUsers !== null && userCount > limits.maxUsers) {
        throw new ConflictException(
          `O plano ${limits.label} permite ${limits.maxUsers} usuários, mas a organização tem ${userCount}. Remova usuários antes de baixar o plano.`,
        )
      }

      await this.prisma.tenant.update({
        where: { id },
        data: {
          planTier: tier,
          // 0 = unlimited (Enterprise) — matches the tier-limit guards.
          maxUnits: limits.maxUnits ?? 0,
          maxUsers: limits.maxUsers ?? 0,
        },
      })
      await this.prisma.subscription.updateMany({ where: { tenantId: id }, data: { tier } })
      await this.audit(id, adminId, 'CHANGE_TIER', { from: tenant.planTier, to: tier })
      this.eventBus.publish(new TenantTierChangedEvent(id, tenant.planTier as PlanTier, tier))

      return this.detail(id)
    })
  }

  /**
   * Impersonate a tenant admin for support (plano 26.5) — issues that user's JWT
   * cookie. Powerful: platform-admin only (controller guard) and AUDITED. The
   * frontend must show a visible "impersonating" banner.
   */
  async impersonate(id: string, admin: JwtPayload, res: any) {
    return runWithoutTenant(async () => {
      const tenant = await this.getTenantOrThrow(id)

      const target = await this.prisma.user.findFirst({
        where: {
          tenantId: id,
          isActive: true,
          unitAccess: { some: { role: { in: [UserRole.SUPER_ADMIN, UserRole.DIRETORIA] } } },
        },
        include: { unitAccess: true },
      })
      if (!target) {
        throw new NotFoundException('Nenhum administrador ativo nesta organização para impersonar.')
      }
      if (!target.tenantId) throw new UnauthorizedException('Usuário alvo sem organização.')

      const primaryUnit = target.unitAccess.find((u) => u.isPrimary)
      const payload: JwtPayload = {
        sub: target.id,
        email: target.email,
        name: target.name,
        role: (primaryUnit?.role ?? target.unitAccess[0]?.role) as UserRole,
        accessScope: target.accessScope as AccessScope,
        tenantId: target.tenantId,
        tenantSlug: tenant.slug,
        isPlatformAdmin: false, // impersonation never grants platform powers
        units: target.unitAccess.map((u) => u.unitId),
      }
      const token = this.jwt.sign(payload)
      res.cookie('auth_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 8 * 60 * 60 * 1000,
      })

      await this.audit(id, admin.sub, 'IMPERSONATE_TENANT', { targetUserId: target.id })

      return {
        impersonating: { tenantId: id, tenantName: tenant.name, userId: target.id, userName: target.name },
      }
    })
  }

  private async getTenantOrThrow(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } })
    if (!tenant || tenant.deletedAt) throw new NotFoundException('Organização não encontrada.')
    return tenant
  }

  private async audit(
    tenantId: string,
    adminId: string,
    action: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: adminId,
        action,
        entityType: 'Tenant',
        entityId: tenantId,
        ipAddress: '',
        metadata: (metadata ?? {}) as Prisma.InputJsonValue,
      },
    })
  }
}
