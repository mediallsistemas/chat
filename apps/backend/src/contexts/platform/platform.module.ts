import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PlatformTenantsController } from './tenants/platform-tenants.controller'
import { PlatformTenantsService } from './tenants/platform-tenants.service'
import { BillingController } from './billing/billing.controller'
import { PlatformBillingController } from './billing/platform-billing.controller'
import { BillingService } from './billing/billing.service'
import { StripeService } from './billing/stripe.service'
import { PlatformAdminGuard } from './guards/platform-admin.guard'

/**
 * Platform context (plano 26) — the SaaS owner's domain: tenant management,
 * billing reconciliation and the Stripe webhook. The ONLY context authorized to
 * cross tenant boundaries, gated by `PlatformAdminGuard` (architecture.md §0).
 *
 * JwtModule is registered locally so impersonation can mint a tenant-user token
 * (same secret/expiry as auth). PrismaService/EventBusService are global.
 */
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET!,
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '8h' },
    }),
  ],
  controllers: [PlatformTenantsController, BillingController, PlatformBillingController],
  providers: [PlatformTenantsService, BillingService, StripeService, PlatformAdminGuard],
})
export class PlatformModule {}
