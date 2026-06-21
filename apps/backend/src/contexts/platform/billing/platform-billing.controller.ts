import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
  RawBodyRequest,
} from '@nestjs/common'
import { ApiExcludeEndpoint } from '@nestjs/swagger'
import { Request } from 'express'
import { Public } from '../../../shared/decorators/public.decorator'
import { StripeService } from './stripe.service'
import { BillingService } from './billing.service'

/**
 * Stripe webhook endpoint (plano 26.3): POST /api/v1/platform/billing/webhook.
 *
 * `@Public()` — Stripe calls it without a JWT. The body must be the RAW bytes
 * (enabled via `rawBody: true` in main.ts) so the signature verifies; the CSRF
 * middleware is bypassed for this exact path in main.ts. The signature is
 * verified before anything is trusted (riscos §1), and idempotency is handled by
 * `BillingService` via `billing_events.provider_event_id`.
 */
@Controller('platform/billing')
export class PlatformBillingController {
  constructor(
    private stripe: StripeService,
    private billing: BillingService,
  ) {}

  @Post('webhook')
  @Public()
  @HttpCode(200)
  @ApiExcludeEndpoint()
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!this.stripe.isEnabled()) {
      // Billing off in this environment — acknowledge so Stripe stops retrying.
      return { received: true, ignored: true }
    }
    if (!req.rawBody || !signature) {
      throw new BadRequestException('Webhook inválido.')
    }

    let event: unknown
    try {
      event = this.stripe.constructWebhookEvent(req.rawBody, signature)
    } catch {
      // Bad signature → never process. 400 tells Stripe it was rejected.
      throw new BadRequestException('Assinatura do webhook inválida.')
    }

    const result = await this.billing.processWebhookEvent(event)
    return { received: true, ...result }
  }
}
