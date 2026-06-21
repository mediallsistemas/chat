import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common'
import { JwtPayload } from '@mediall/types'
import { PrismaService } from '../../../prisma/prisma.service'

/**
 * Platform-admin authorization (plano 26.5). Guards the `platform` context — the
 * SaaS owner who operates across ALL tenants (the single authorized exception to
 * the tenant boundary). Applied at the controller level, on top of the global
 * stack (so the request is already authenticated).
 *
 * The platform flag is re-checked against the DB on every request: a JWT must
 * never be able to self-elevate to platform admin (the `isPlatformAdmin` claim in
 * the token is a UI hint only). Reading the admin's own user record is naturally
 * tenant-scoped to their tenant, which is exactly where their record lives.
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest()
    const user: JwtPayload | undefined = req.user
    if (!user?.sub) throw new ForbiddenException('Acesso restrito.')

    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { isPlatformAdmin: true },
    })

    if (!dbUser?.isPlatformAdmin) {
      throw new ForbiddenException('Acesso restrito ao administrador da plataforma.')
    }

    return true
  }
}
