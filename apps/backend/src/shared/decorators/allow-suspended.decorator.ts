import { SetMetadata } from '@nestjs/common'

/**
 * Marks a route as reachable even when the tenant's subscription is
 * SUSPENDED/CANCELED (plano 26.4). Mirrors `@Public()` but only relaxes the
 * `BillingGuard` — auth/role/unit guards still apply.
 *
 * Use on: logout, the tenant's own billing screen/actions (so they can pay and
 * regularize), and anything that must keep working under suspension.
 */
export const ALLOW_SUSPENDED_KEY = 'allowSuspended'
export const AllowSuspended = () => SetMetadata(ALLOW_SUSPENDED_KEY, true)
