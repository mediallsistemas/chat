import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcrypt'
import { createHash } from 'crypto'
import Redis from 'ioredis'
import { PrismaService } from '../prisma/prisma.service'
import { LoginDto } from './dto/login.dto'
import { JwtPayload, AccessScope, UserRole } from '@mediall/types'

const MAX_FAILED_LOGINS = 5
const ACCESS_TTL_MS = 15 * 60 * 1000 // 15 minutes
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const REFRESH_TTL_S = REFRESH_TTL_MS / 1000
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!

@Injectable()
export class AuthService {
  private readonly redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    lazyConnect: false,
    maxRetriesPerRequest: 2,
  })

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  private redisKey(userId: string) {
    return `refresh:${userId}`
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex')
  }

  private cookieOpts(maxAge: number) {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge,
    }
  }

  /** Sign access + refresh tokens, persist the refresh hash in Redis, set both cookies. */
  private async issueSession(payload: JwtPayload, res: any) {
    const accessToken = this.jwtService.sign(payload)
    const refreshToken = this.jwtService.sign(
      { sub: payload.sub },
      { secret: REFRESH_SECRET, expiresIn: '7d' },
    )

    // Single active refresh token per user (rotation on each refresh).
    await this.redis.set(
      this.redisKey(payload.sub),
      this.hashToken(refreshToken),
      'EX',
      REFRESH_TTL_S,
    )

    res.cookie('auth_token', accessToken, this.cookieOpts(ACCESS_TTL_MS))
    res.cookie('refresh_token', refreshToken, {
      ...this.cookieOpts(REFRESH_TTL_MS),
      path: '/api/v1/auth', // refresh cookie only travels to auth routes
    })
  }

  private buildPayload(user: {
    id: string
    email: string
    name: string
    accessScope: string
    unitAccess: { unitId: string; role: string; isPrimary: boolean }[]
  }): JwtPayload {
    const units = user.unitAccess.map((u) => u.unitId)
    const primaryUnit = user.unitAccess.find((u) => u.isPrimary)
    return {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: (primaryUnit?.role ?? user.unitAccess[0]?.role) as UserRole,
      accessScope: user.accessScope as AccessScope,
      units,
    }
  }

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

    const payload = this.buildPayload(user)
    await this.issueSession(payload, res)

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        role: payload.role,
        accessScope: payload.accessScope,
        units: payload.units,
        customStatus: user.customStatus,
        customStatusEmoji: user.customStatusEmoji,
        statusExpiresAt: user.statusExpiresAt?.toISOString() ?? null,
      },
    }
  }

  /**
   * Exchange a valid refresh cookie for a fresh access token (and rotated refresh).
   * Rejects if the token is invalid, expired, or no longer the active one in Redis.
   */
  async refresh(refreshToken: string | undefined, res: any) {
    if (!refreshToken) throw new UnauthorizedException('Sessão expirada.')

    let decoded: { sub: string }
    try {
      decoded = this.jwtService.verify(refreshToken, { secret: REFRESH_SECRET })
    } catch {
      throw new UnauthorizedException('Sessão expirada.')
    }

    const stored = await this.redis.get(this.redisKey(decoded.sub))
    if (!stored || stored !== this.hashToken(refreshToken)) {
      throw new UnauthorizedException('Sessão expirada.')
    }

    const user = await this.prisma.user.findUnique({
      where: { id: decoded.sub },
      include: { unitAccess: true },
    })
    if (!user || !user.isActive || user.lockedAt) {
      await this.redis.del(this.redisKey(decoded.sub))
      throw new UnauthorizedException('Sessão expirada.')
    }

    const payload = this.buildPayload(user)
    await this.issueSession(payload, res)
    return { success: true }
  }

  async logout(res: any, user?: JwtPayload) {
    if (user?.sub) await this.redis.del(this.redisKey(user.sub))
    res.clearCookie('auth_token')
    res.clearCookie('refresh_token', { path: '/api/v1/auth' })
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
