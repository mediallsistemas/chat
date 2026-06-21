import { Body, Controller, Get, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { BillingService } from './billing.service'
import { StripeService } from './stripe.service'
import { PrismaService } from '../../../prisma/prisma.service'
import { Roles } from '../../../shared/decorators/roles.decorator'
import { AllowSuspended } from '../../../shared/decorators/allow-suspended.decorator'
import { CurrentUser } from '../../../shared/decorators/current-user.decorator'
import { JwtPayload, UserRole } from '@mediall/types'
import { NotFoundException } from '@nestjs/common'

/**
 * Tenant-facing billing (plano 26.6) — the customer's own subscription screen.
 * Tenant-scoped (NOT BaseUnitController: billing is per-tenant, not per-unit) and
 * limited to tenant admins. Marked `@AllowSuspended()` so a suspended tenant can
 * still see the screen and pay to regularize.
 */
@ApiTags('billing')
@Controller('billing')
@AllowSuspended()
export class BillingController {
  constructor(
    private billing: BillingService,
    private stripe: StripeService,
    private prisma: PrismaService,
  ) {}

  /**
   * Current subscription, plan limits and usage for the logged-in tenant. Open to
   * any authenticated tenant user (read-only, own-tenant data) so the suspension
   * banner works for everyone — payment actions below stay admin-only.
   */
  @Get('me')
  getMine() {
    return this.billing.getCurrentSubscriptionView()
  }

  /** Stripe Billing Portal URL (manage card/invoices). Requires billing enabled. */
  @Post('portal')
  @Roles(UserRole.SUPER_ADMIN, UserRole.DIRETORIA)
  async portal(@CurrentUser() user: JwtPayload) {
    const sub = await this.prisma.subscription.findUnique({
      where: { tenantId: user.tenantId },
      select: { providerCustomerId: true },
    })
    if (!sub?.providerCustomerId) {
      throw new NotFoundException('Nenhum cliente de pagamento associado a esta organização.')
    }
    const returnUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/configuracoes/assinatura`
    const url = await this.stripe.createBillingPortalSession(sub.providerCustomerId, returnUrl)
    return { url }
  }

  /** Start a Checkout session to subscribe/upgrade to a tier's Stripe price. */
  @Post('checkout')
  @Roles(UserRole.SUPER_ADMIN, UserRole.DIRETORIA)
  async checkout(@CurrentUser() user: JwtPayload, @Body() dto: { priceId: string }) {
    const sub = await this.prisma.subscription.findUnique({
      where: { tenantId: user.tenantId },
      select: { providerCustomerId: true },
    })
    const base = process.env.FRONTEND_URL || 'http://localhost:3000'
    const url = await this.stripe.createCheckoutSession({
      tenantId: user.tenantId,
      customerId: sub?.providerCustomerId ?? undefined,
      priceId: dto.priceId,
      successUrl: `${base}/configuracoes/assinatura?status=success`,
      cancelUrl: `${base}/configuracoes/assinatura?status=cancel`,
    })
    return { url }
  }
}
