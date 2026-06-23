import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcrypt'
import { PrismaService } from '../prisma/prisma.service'
import { LoginDto } from './dto/login.dto'
import { SignupDto } from './dto/signup.dto'
import { JwtPayload, AccessScope, UserRole } from '@mediall/types'

const MAX_FAILED_LOGINS = 5
const TRIAL_DAYS = 14
const BCRYPT_COST = 12

/** Turn a company name into a URL-safe, unique-ish slug seed. */
function slugify(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // strip accents
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'tenant'
  )
}

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

  /**
   * Public tenant self-signup (plano 26.2). Provisions a fresh tenant with a
   * 14-day trial — no card required (Stripe is linked later via the billing
   * portal). Creates Tenant → admin User → default Unit → UserUnit → trial
   * Subscription, then signs the user in (same cookie as login).
   *
   * Runs on a `@Public()` route, so there is no tenant context — the Prisma
   * auto-scope middleware is inert and we set `tenantId` explicitly on every row.
   */
  async signup(dto: SignupDto, res: any) {
    const email = dto.email.trim().toLowerCase()

    const existing = await this.prisma.user.findUnique({ where: { email }, select: { id: true } })
    if (existing) {
      throw new ConflictException('Já existe uma conta com este e-mail.')
    }

    const slug = await this.uniqueTenantSlug(slugify(dto.companyName))
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_COST)
    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000)

    const { user, unit, tenant } = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        // status TRIAL, planTier STARTER, maxUnits 3, maxUsers 25 come from schema defaults.
        data: { name: dto.companyName.trim(), slug, trialEndsAt },
      })

      // Create the admin first: the unit's required `managerId` points at them.
      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          name: dto.name.trim(),
          email,
          passwordHash,
          accessScope: 'GLOBAL', // tenant owner sees every unit in their holding
        },
      })

      const unit = await tx.unit.create({
        data: {
          tenantId: tenant.id,
          name: dto.companyName.trim(),
          type: 'MATRIZ',
          managerId: user.id,
        },
      })

      await tx.userUnit.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          unitId: unit.id,
          role: 'SUPER_ADMIN',
          isPrimary: true,
          grantedBy: user.id,
        },
      })

      await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          tier: 'STARTER',
          status: 'TRIALING',
          currentPeriodEnd: trialEndsAt,
        },
      })

      return { user, unit, tenant }
    })

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: UserRole.SUPER_ADMIN,
      accessScope: AccessScope.GLOBAL,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      isPlatformAdmin: false,
      units: [unit.id],
    }

    const token = this.jwtService.sign(payload)
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000,
    })

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        role: payload.role,
        accessScope: payload.accessScope,
        isPlatformAdmin: false,
        units: payload.units,
        customStatus: user.customStatus,
        customStatusEmoji: user.customStatusEmoji,
        statusExpiresAt: user.statusExpiresAt?.toISOString() ?? null,
      },
    }
  }

  /** Find a free tenant slug, appending -2, -3… on collision. */
  private async uniqueTenantSlug(seed: string): Promise<string> {
    let candidate = seed
    let n = 1
    // Bounded loop; slug space is large enough that this resolves immediately in practice.
    while (await this.prisma.tenant.findUnique({ where: { slug: candidate }, select: { id: true } })) {
      n += 1
      candidate = `${seed}-${n}`
    }
    return candidate
  }

  async logout(res: any) {
    res.clearCookie('auth_token')
    return { message: 'Sessão encerrada com sucesso.' }
  }

  async me(user: JwtPayload) {
    const profile = await this.prisma.user.findUnique({
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
    if (!profile) return profile
    // The impersonation marker lives on the JWT, not the user row — surface it so
    // the frontend can show the "you are impersonating X" banner (plano 26.5).
    return { ...profile, impersonatedTenantName: user.impersonatedTenantName ?? null }
  }
}
