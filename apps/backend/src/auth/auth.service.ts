import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcrypt'
import { PrismaService } from '../prisma/prisma.service'
import { LoginDto } from './dto/login.dto'
import { JwtPayload, AccessScope, UserRole } from '@mediall/types'

const MAX_FAILED_LOGINS = 5

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(dto: LoginDto, res: any) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { unitAccess: true },
    })

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Credenciais inválidas.')
    }

    if (user.lockedAt) {
      throw new ForbiddenException(
        'Conta bloqueada após múltiplas tentativas. Contate o administrador.',
      )
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash)

    if (!passwordValid) {
      const failed = user.failedLogins + 1
      const shouldLock = failed >= MAX_FAILED_LOGINS

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLogins: failed,
          lockedAt: shouldLock ? new Date() : null,
        },
      })

      throw new UnauthorizedException('Credenciais inválidas.')
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLogins: 0, lastSeenAt: new Date() },
    })

    const units = user.unitAccess.map((u) => u.unitId)
    const primaryUnit = user.unitAccess.find((u) => u.isPrimary)

    // Multitenancy (plano 23.2): a user must belong to a tenant to authenticate.
    // After the 23.1 backfill every user has one; new users get one at creation.
    if (!user.tenantId) {
      throw new UnauthorizedException(
        'Usuário sem organização associada. Contate o administrador.',
      )
    }

    // Multitenancy (plano 23.4): embed the tenant slug for the host check.
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { slug: true },
    })
    if (!tenant) {
      throw new UnauthorizedException('Organização inválida. Contate o administrador.')
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: (primaryUnit?.role ?? user.unitAccess[0]?.role) as UserRole,
      accessScope: user.accessScope as AccessScope,
      tenantId: user.tenantId,
      tenantSlug: tenant.slug,
      isPlatformAdmin: user.isPlatformAdmin,
      units,
    }

    const token = this.jwtService.sign(payload)

    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000, // 8 hours — covers the 7h inactivity window
    })

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        role: payload.role,
        accessScope: payload.accessScope,
        isPlatformAdmin: user.isPlatformAdmin,
        units: payload.units,
        customStatus: user.customStatus,
        customStatusEmoji: user.customStatusEmoji,
        statusExpiresAt: user.statusExpiresAt?.toISOString() ?? null,
      },
    }
  }

  async logout(res: any) {
    res.clearCookie('auth_token')
    return { message: 'Sessão encerrada com sucesso.' }
  }

  async me(user: JwtPayload) {
    return this.prisma.user.findUnique({
      where: { id: user.sub },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        accessScope: true,
        isPlatformAdmin: true,
        customStatus: true,
        customStatusEmoji: true,
        statusExpiresAt: true,
        unitAccess: {
          select: { unitId: true, role: true, isPrimary: true },
        },
      },
    })
  }
}
