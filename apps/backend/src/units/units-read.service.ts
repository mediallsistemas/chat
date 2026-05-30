import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { UnitsReadPort, UnitSnapshot } from '../shared/ports'

/**
 * Read-only projection of the Unit aggregate exposed to other contexts.
 * Concrete implementation of {@link UnitsReadPort}. Other contexts must
 * depend on the port interface, not this class.
 */
@Injectable()
export class UnitsReadService implements UnitsReadPort {
  constructor(private prisma: PrismaService) {}

  async getById(unitId: string): Promise<UnitSnapshot | null> {
    return this.prisma.unit.findUnique({
      where: { id: unitId },
      select: { id: true, name: true, type: true, isActive: true, parentId: true },
    })
  }

  async listForUser(userId: string): Promise<UnitSnapshot[]> {
    const memberships = await this.prisma.userUnit.findMany({
      where: { userId },
      include: {
        unit: { select: { id: true, name: true, type: true, isActive: true, parentId: true } },
      },
    })
    return memberships.map((m) => m.unit)
  }
}
