import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'

/**
 * Thin wrapper around the Stripe SDK (plano 26.2/26.3).
 *
 * Billing is an OPTIONAL, env-gated feature: it only activates when
 * `BILLING_ENABLED=true`. When enabled, `STRIPE_SECRET_KEY` and
 * `STRIPE_WEBHOOK_SECRET` are required at boot (REQUIRED_ENV_VARS in main.ts) —
 * no insecure fallback (security.md §2). When disabled, every call throws a
 * clear 503 and the app boots fine without Stripe keys (dev default).
 *
 * The `stripe` package is loaded lazily via `require` so the backend compiles
 * and runs without it installed. To turn billing on in an environment:
 *   1) `npm i stripe` in apps/backend
 *   2) set BILLING_ENABLED=true + STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET
 */
@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name)
  // Loosely typed: the SDK isn't a compile-time dependency (see class doc).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: any | null = null

  isEnabled(): boolean {
    return process.env.BILLING_ENABLED === 'true'
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getClient(): any {
    if (!this.isEnabled()) {
      throw new ServiceUnavailableException('Billing não está habilitado neste ambiente.')
    }
    if (this.client) return this.client

    let Stripe: any // eslint-disable-line @typescript-eslint/no-explicit-any
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      Stripe = require('stripe')
    } catch {
      this.logger.error('BILLING_ENABLED=true mas o pacote "stripe" não está instalado.')
      throw new ServiceUnavailableException('Integração de pagamento indisponível.')
    }

    this.client = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' })
    return this.client
  }

  /**
   * Verify + parse a webhook payload (raw body + signature). Throws on a bad
   * signature — the webhook controller turns that into a 400 (never trust an
   * unverified payload — riscos §1).
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructWebhookEvent(rawBody: Buffer | string, signature: string): any {
    const secret = process.env.STRIPE_WEBHOOK_SECRET
    if (!secret) throw new ServiceUnavailableException('Webhook de pagamento não configurado.')
    return this.getClient().webhooks.constructEvent(rawBody, signature, secret)
  }

  /** Create a Stripe customer for a tenant (onboarding). Returns the customer id. */
  async createCustomer(params: { tenantId: string; name: string; email?: string }): Promise<string> {
    const customer = await this.getClient().customers.create({
      name: params.name,
      email: params.email,
      metadata: { tenantId: params.tenantId },
    })
    return customer.id
  }

  /**
   * Stripe Checkout session for subscribing/upgrading to a tier. The price id per
   * tier comes from env (`STRIPE_PRICE_STARTER` / `_PRO`). Returns the hosted URL.
   */
  async createCheckoutSession(params: {
    tenantId: string
    customerId?: string
    priceId: string
    successUrl: string
    cancelUrl: string
  }): Promise<string> {
    const session = await this.getClient().checkout.sessions.create({
      mode: 'subscription',
      customer: params.customerId,
      line_items: [{ price: params.priceId, quantity: 1 }],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: { tenantId: params.tenantId },
      subscription_data: { metadata: { tenantId: params.tenantId } },
    })
    return session.url
  }

  /** Stripe Billing Portal session — lets the tenant manage card/invoices. */
  async createBillingPortalSession(customerId: string, returnUrl: string): Promise<string> {
    const session = await this.getClient().billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    })
    return session.url
  }
}
