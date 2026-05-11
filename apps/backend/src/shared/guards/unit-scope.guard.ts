import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AccessScope, JwtPayload } from '@mediall/types'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator'

@Injectable()
export class UnitScopeGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const request = context.switchToHttp().getRequest()
    const user: JwtPayload = request.user

    if (!user) return false

    const unitId: string | undefined = request.params?.unitId

    if (!unitId) return true
    if (user.accessScope === AccessScope.GLOBAL) return true

    return user.units.includes(unitId)
  }
}
