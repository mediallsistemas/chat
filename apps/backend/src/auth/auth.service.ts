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

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: (primaryUnit?.role ?? user.unitAccess[0]?.role) as UserRole,
      accessScope: user.accessScope as AccessScope,
      units,
    }

    const token = this.jwtService.sign(payload)

    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000, // 15 minutes
    })

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        role: payload.role,
        accessScope: payload.accessScope,
        units: payload.units,
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
        unitAccess: {
          select: { unitId: true, role: true, isPrimary: true },
        },
      },
    })
  }
}
