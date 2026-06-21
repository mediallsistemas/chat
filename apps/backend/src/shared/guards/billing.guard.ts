import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtPayload, TenantStatus } from '@mediall/types'
import { PrismaService } from '../../prisma/prisma.service'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator'
import { ALLOW_SUSPENDED_KEY } from '../decorators/allow-suspended.decorator'

/** HTTP methods that only read — always allowed (read-only access under suspension). */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/** Tenant statuses that block mutations. PAST_DUE stays open (banner only). */
const BLOCKED_STATUSES = new Set<TenantStatus>([
  TenantStatus.SUSPENDED,
  TenantStatus.CANCELED,
])

/**
 * Billing enforcement (plano 26.4). Runs after `TenantGuard`, before
 * `RolesGuard`:
 *
 *   JwtAuthGuard → TenantGuard → BillingGuard → RolesGuard → UnitScopeGuard
 *
 * Policy (decisão de produto do plano 26): inadimplência é **somente-leitura**.
 * - GET/HEAD/OPTIONS → sempre liberado (o cliente vê os dados e a tela de billing).
 * - Mutação (POST/PUT/PATCH/DELETE) com tenant SUSPENDED/CANCELED → 403 com
 *   mensagem clara de regularização.
 * - PAST_DUE não bloqueia (banner de aviso no front).
 * - `@Public()` e `@AllowSuspended()` (login, logout, billing do tenant) passam.
 *
 * Lê o status do banco (não do JWT) para refletir a suspensão na hora — um token
 * de 8h não pode manter um inadimplente mutando. Só toca o banco em mutações de
 * rota não-isenta, então o custo é baixo.
 */
@Injectable()
export class BillingGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const meta = [context.getHandler(), context.getClass()]
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, meta)) return true
    if (this.reflector.getAllAndOverride<boolean>(ALLOW_SUSPENDED_KEY, meta)) return true

    const req = context.switchToHttp().getRequest()

    // Read-only is always allowed (suspension is read-only, not blackout).
    if (SAFE_METHODS.has(req.method)) return true

    const user: JwtPayload | undefined = req.user
    if (!user?.tenantId) return true // legacy token / no tenant context → no-op

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { status: true },
    })

    if (tenant && BLOCKED_STATUSES.has(tenant.status as TenantStatus)) {
      throw new ForbiddenException(
        'Assinatura suspensa — regularize o pagamento para voltar a editar. ' +
          'A leitura continua disponível.',
      )
    }

    return true
  }
}
