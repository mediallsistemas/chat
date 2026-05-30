import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { UsersReadPort, UserSnapshot } from '../shared/ports'

/**
 * Read-only projection of the User aggregate exposed to other contexts.
 * Concrete implementation of {@link UsersReadPort}. Other contexts must
 * depend on the port interface, not this class.
 */
@Injectable()
export class UsersReadService implements UsersReadPort {
  constructor(private prisma: PrismaService) {}

  async getById(userId: string): Promise<UserSnapshot | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, isActive: true, avatarUrl: true },
    })
    return user
  }

  async getByIds(userIds: string[]): Promise<UserSnapshot[]> {
    if (userIds.length === 0) return []
    return this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true, isActive: true, avatarUrl: true },
    })
  }

  async getEmail(userId: string): Promise<{ name: string; email: string } | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    })
  }
}
