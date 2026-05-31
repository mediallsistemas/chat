import { Injectable, NotFoundException, ConflictException } from '@nestjs/common'
import * as bcrypt from 'bcrypt'
import { randomBytes } from 'crypto'
import { PrismaService } from '../prisma/prisma.service'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'
import { PaginationDto } from '../shared/dto/pagination.dto'
import { JwtPayload, UserRole } from '@mediall/types'

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(pagination: PaginationDto, role?: UserRole) {
    const { page = 1, limit = 50, search } = pagination
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' as const } },
        { email: { contains: search, mode: 'insensitive' as const } },
      ]
    }
    if (role) {
      // Match users who hold the given role in at least one unit.
      where.unitAccess = { some: { role } }
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true, name: true, email: true, avatarUrl: true,
          accessScope: true, isActive: true, createdAt: true, lastSeenAt: true,
          unitAccess: { select: { unitId: true, role: true, isPrimary: true, unit: { select: { name: true } } } },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.user.count({ where }),
    ])

    return { users, total, page, limit }
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true, name: true, email: true, avatarUrl: true,
        accessScope: true, isActive: true, createdAt: true,
        unitAccess: { select: { unitId: true, role: true, isPrimary: true } },
      },
    })

    if (!user) throw new NotFoundException('Usuário não encontrado.')
    return user
  }

  async create(dto: CreateUserDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } })
    if (exists) throw new ConflictException('E-mail já cadastrado.')

    const passwordHash = await bcrypt.hash(dto.password, 12)

    return this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        passwordHash,
        accessScope: dto.accessScope,
        avatarUrl: dto.avatarUrl,
      },
      select: { id: true, name: true, email: true, accessScope: true, createdAt: true },
    })
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id)

    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: { id: true, name: true, email: true, avatarUrl: true, isActive: true },
    })
  }

  async unlock(id: string) {
    await this.findOne(id)
    return this.prisma.user.update({
      where: { id },
      data: { failedLogins: 0, lockedAt: null },
      select: { id: true, name: true, lockedAt: true },
    })
  }

  async updateProfile(userId: string, dto: { name?: string; avatarUrl?: string }) {
    await this.findOne(userId)
    return this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: { id: true, name: true, email: true, avatarUrl: true },
    })
  }

  async updateStatus(
    userId: string,
    dto: { customStatus?: string | null; customStatusEmoji?: string | null; statusExpiresAt?: string | null },
  ) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        customStatus: dto.customStatus ?? null,
        customStatusEmoji: dto.customStatusEmoji ?? null,
        statusExpiresAt: dto.statusExpiresAt ? new Date(dto.statusExpiresAt) : null,
      },
      select: {
        id: true,
        customStatus: true,
        customStatusEmoji: true,
        statusExpiresAt: true,
      },
    })
  }

  async clearExpiredStatuses(): Promise<number> {
    const result = await this.prisma.user.updateMany({
      where: { statusExpiresAt: { lte: new Date() } },
      data: { customStatus: null, customStatusEmoji: null, statusExpiresAt: null },
    })
    return result.count
  }

  async anonymizeUser(userId: string, requestedBy: string): Promise<void> {
    await this.prisma.user.findUniqueOrThrow({ where: { id: userId } })
    const anonymousId = randomBytes(8).toString('hex')

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          name: 'Usuário Removido',
          email: `removido_${anonymousId}@mediall.invalid`,
          passwordHash: 'ANONYMIZED',
          avatarUrl: null,
          phone: null,
          isActive: false,
        },
      }),
      this.prisma.pushSubscription.deleteMany({ where: { userId } }),
      this.prisma.auditLog.create({
        data: {
          userId: requestedBy,
          action: 'ANONYMIZE_USER',
          entityType: 'User',
          entityId: userId,
          ipAddress: '',
          metadata: { reason: 'LGPD Art. 18 - Direito ao esquecimento' },
        },
      }),
    ])
  }

  async exportUserData(userId: string) {
    const [user, messages, tickets, auditLogs] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, createdAt: true },
      }),
      this.prisma.message.findMany({
        where: { senderId: userId },
        select: { content: true, createdAt: true, group: { select: { name: true } } },
        take: 1000,
      }),
      this.prisma.ticket.findMany({
        where: { reportedBy: userId },
        select: { title: true, description: true, status: true, createdAt: true },
      }),
      this.prisma.auditLog.findMany({
        where: { userId },
        select: { action: true, entityType: true, createdAt: true },
        take: 500,
      }),
    ])

    return { user, messages, tickets, auditLogs, exportedAt: new Date().toISOString() }
  }

  async searchByName(q: string, requester: JwtPayload) {
    if (!q || q.length < 2) return []
    return this.prisma.user.findMany({
      where: {
        isActive: true,
        name: { contains: q, mode: 'insensitive' },
        ...(requester.accessScope !== 'GLOBAL' && {
          unitAccess: { some: { unitId: { in: requester.units } } },
        }),
      },
      select: { id: true, name: true, avatarUrl: true },
      take: 10,
    })
  }
}
