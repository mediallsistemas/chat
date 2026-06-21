import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateUnitDto } from './dto/create-unit.dto'
import { AssignUserDto } from './dto/assign-user.dto'
import { JwtPayload, AccessScope } from '@mediall/types'
import { getCurrentTenantId } from '../shared/tenant/tenant-context'

@Injectable()
export class UnitsService {
  constructor(private prisma: PrismaService) {}

  async findAll(user: JwtPayload) {
    const where =
      user.accessScope === AccessScope.GLOBAL
        ? {}
        : { id: { in: user.units } }

    return this.prisma.unit.findMany({
      where,
      include: { manager: { select: { id: true, name: true, email: true } } },
      orderBy: { name: 'asc' },
    })
  }

  async findOne(id: string) {
    const unit = await this.prisma.unit.findUnique({
      where: { id },
      include: {
        manager: { select: { id: true, name: true, email: true } },
        userUnits: {
          include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
        },
        children: true,
      },
    })

    if (!unit) throw new NotFoundException('Unidade não encontrada.')
    return unit
  }

  async create(dto: CreateUnitDto) {
    await this.assertUnitQuota()

    return this.prisma.unit.create({
      data: {
        name: dto.name,
        type: dto.type,
        parentId: dto.parentId,
        managerId: dto.managerId,
      },
    })
  }

  /**
   * Tier limit (plano 26.4): block creating a unit beyond the tenant's `maxUnits`.
   * No-op without a tenant context (jobs/seed) or for unlimited tiers (maxUnits 0
   * is treated as "unset" — Enterprise/legacy). The check counts the tenant's own
   * units explicitly so it's exact during the nullable-tenant transition.
   */
  private async assertUnitQuota(): Promise<void> {
    const tenantId = getCurrentTenantId()
    if (!tenantId) return

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { maxUnits: true },
    })
    if (!tenant || tenant.maxUnits <= 0) return

    const count = await this.prisma.unit.count({ where: { tenantId } })
    if (count >= tenant.maxUnits) {
      throw new ForbiddenException(
        `Limite de ${tenant.maxUnits} unidades do seu plano atingido. ` +
          'Faça upgrade do plano para adicionar mais unidades.',
      )
    }
  }

  async findMembers(unitId: string) {
    await this.findOne(unitId)
    const rows = await this.prisma.userUnit.findMany({
      where: { unitId },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      orderBy: { user: { name: 'asc' } },
    })
    return rows.map((r) => r.user)
  }

  async assignUser(unitId: string, dto: AssignUserDto, grantedBy: string) {
    await this.findOne(unitId)

    return this.prisma.userUnit.upsert({
      where: { userId_unitId: { userId: dto.userId, unitId } },
      update: {
        role: dto.role,
        isPrimary: dto.isPrimary ?? false,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
      create: {
        userId: dto.userId,
        unitId,
        role: dto.role,
        isPrimary: dto.isPrimary ?? false,
        grantedBy,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    })
  }

  async removeUser(unitId: string, userId: string) {
    await this.findOne(unitId)

    return this.prisma.userUnit.delete({
      where: { userId_unitId: { userId, unitId } },
    })
  }
}
