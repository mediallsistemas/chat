import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtPayload } from '@mediall/types'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator'
import { tenantStorage, extractTenantSlugFromHost } from '../tenant/tenant-context'

/**
 * Multitenancy plano 23.2 — establishes the per-request tenant context.
 *
 * Runs right after `JwtAuthGuard` (so `req.user` is populated), before
 * `RolesGuard`/`UnitScopeGuard`. It pulls `tenantId` from the validated JWT and
 * stores it in AsyncLocalStorage so downstream code (the Prisma tenant
 * extension, plano 23.3) can auto-scope queries to the current tenant.
 *
 * Transition note (23.2): tokens issued before `tenantId` existed won't carry it.
 * We do NOT reject those — that would force every active user to re-login. We
 * just skip setting the context (no auto-scope; services keep their manual
 * `unitId` filters). Strict rejection + subdomain/host match arrive with plano
 * 23.4, once everyone has re-authenticated.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const req = context.switchToHttp().getRequest()
    const user: JwtPayload | undefined = req.user

    // 23.4 — anti cross-tenant replay: if the request hits a tenant subdomain, it
    // must match the session's tenant. Dev/localhost has no subdomain → no-op.
    const hostSlug = extractTenantSlugFromHost(req.headers?.host)
    if (hostSlug && user?.tenantSlug && hostSlug !== user.tenantSlug) {
      throw new ForbiddenException(
        'A organização do endereço não confere com a sua sessão.',
      )
    }

    if (user?.tenantId) {
      tenantStorage.enterWith({ tenantId: user.tenantId })
    }

    return true
  }
}
