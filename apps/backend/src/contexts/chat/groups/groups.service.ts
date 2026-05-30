import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { CreateGroupDto, AddMemberDto } from './dto/create-group.dto'
import { JwtPayload } from '@mediall/types'

@Injectable()
export class GroupsService {
  constructor(private prisma: PrismaService) {}

  async findAll(unitId: string, userId: string) {
    // Return groups where user is a member OR the group belongs to the unit
    return this.prisma.group.findMany({
      where: {
        unitId,
        isArchived: false,
        members: { some: { userId } },
      },
      include: {
        _count: { select: { members: true, messages: true } },
        members: {
          where: { userId },
          select: { role: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })
  }

  async findOne(unitId: string, groupId: string) {
    const group = await this.prisma.group.findFirst({
      where: { id: groupId, unitId },
      include: {
        members: {
          include: {
            group: false,
            // join user info
          },
          orderBy: { joinedAt: 'asc' },
        },
        _count: { select: { members: true, messages: true } },
      },
    })
    if (!group) throw new NotFoundException('Grupo não encontrado.')
    return group
  }

  async findOneWithMembers(unitId: string, groupId: string) {
    const group = await this.prisma.group.findFirst({
      where: { id: groupId, unitId },
      include: {
        members: {
          include: { group: false },
          orderBy: { joinedAt: 'asc' },
        },
      },
    })
    if (!group) throw new NotFoundException('Grupo não encontrado.')
    return group
  }

  async create(unitId: string, dto: CreateGroupDto, user: JwtPayload) {
    // Create a kanban board for the group
    const board = await this.prisma.kanbanBoard.create({
      data: {
        name: `Board — ${dto.name}`,
        ownerType: 'GROUP',
        ownerId: '', // will update after group creation
        unitId,
        columns: {
          create: [
            { name: 'A fazer', position: 0, isDoneColumn: false },
            { name: 'Em andamento', position: 1, isDoneColumn: false },
            { name: 'Concluído', position: 2, isDoneColumn: true },
          ],
        },
      },
    })

    const group = await this.prisma.group.create({
      data: {
        name: dto.name,
        description: dto.description,
        type: dto.type,
        visibility: dto.visibility ?? 'PRIVATE_INVITE',
        parentId: dto.parentId,
        objectiveId: dto.objectiveId,
        unitId,
        createdBy: user.sub,
        onlyAdminsPost: dto.onlyAdminsPost ?? false,
        archiveAt: dto.archiveAt ? new Date(dto.archiveAt) : null,
        kanbanBoardId: board.id,
        members: {
          create: { userId: user.sub, role: 'ADMIN', addedBy: user.sub },
        },
      },
    })

    // Back-fill ownerId on the board
    await this.prisma.kanbanBoard.update({
      where: { id: board.id },
      data: { ownerId: group.id },
    })

    return group
  }

  async archive(unitId: string, groupId: string, user: JwtPayload) {
    const group = await this.findOne(unitId, groupId)
    const member = group.members.find((m: { userId: string; role: string }) => m.userId === user.sub)

    if (!member || member.role !== 'ADMIN') {
      throw new ForbiddenException('Somente admins podem arquivar o grupo.')
    }

    return this.prisma.group.update({
      where: { id: groupId },
      data: { isArchived: true },
    })
  }

  async addMember(unitId: string, groupId: string, dto: AddMemberDto, user: JwtPayload) {
    const group = await this.findOne(unitId, groupId)
    const requestor = group.members.find((m: { userId: string }) => m.userId === user.sub)
    if (!requestor) throw new ForbiddenException('Você não é membro deste grupo.')

    return this.prisma.groupMember.upsert({
      where: { groupId_userId: { groupId, userId: dto.userId } },
      update: { role: (dto.role as any) ?? 'MEMBER' },
      create: {
        groupId,
        userId: dto.userId,
        role: (dto.role as any) ?? 'MEMBER',
        addedBy: user.sub,
      },
    })
  }

  async removeMember(unitId: string, groupId: string, userId: string, user: JwtPayload) {
    const group = await this.findOne(unitId, groupId)
    const requestor = group.members.find((m: { userId: string; role: string }) => m.userId === user.sub)

    // Allow self-removal or admin removal
    if (userId !== user.sub && (!requestor || requestor.role !== 'ADMIN')) {
      throw new ForbiddenException('Somente admins podem remover membros.')
    }

    return this.prisma.groupMember.delete({
      where: { groupId_userId: { groupId, userId } },
    })
  }

  async findOrCreateDirect(unitId: string, requestorId: string, targetUserId: string) {
    // Find existing non-archived PRIVATE group with exactly these two members
    const candidates = await this.prisma.group.findMany({
      where: {
        unitId,
        type: 'PRIVATE',
        isArchived: false,
        members: { some: { userId: requestorId } },
      },
      include: { members: { select: { userId: true } } },
    })

    const existing = candidates.find(
      (g) =>
        g.members.length === 2 &&
        g.members.some((m) => m.userId === targetUserId),
    )

    if (existing) return existing

    // Create board + group atomically
    const board = await this.prisma.kanbanBoard.create({
      data: {
        name: `DM board`,
        ownerType: 'GROUP',
        ownerId: '',
        unitId,
        columns: {
          create: [
            { name: 'A fazer', position: 0, isDoneColumn: false },
            { name: 'Concluído', position: 1, isDoneColumn: true },
          ],
        },
      },
    })

    const group = await this.prisma.group.create({
      data: {
        name: `direct:${[requestorId, targetUserId].sort().join(':')}`,
        type: 'PRIVATE',
        unitId,
        createdBy: requestorId,
        kanbanBoardId: board.id,
        members: {
          create: [
            { userId: requestorId, role: 'ADMIN', addedBy: requestorId },
            { userId: targetUserId, role: 'MEMBER', addedBy: requestorId },
          ],
        },
      },
    })

    await this.prisma.kanbanBoard.update({
      where: { id: board.id },
      data: { ownerId: group.id },
    })

    return group
  }

  async archiveExpired() {
    await this.prisma.group.updateMany({
      where: {
        type: 'TEMPORARY',
        isArchived: false,
        archiveAt: { lte: new Date() },
      },
      data: { isArchived: true },
    })
  }

  async findDiscoverable(unitId: string, userId: string) {
    // Public groups in this unit the user is NOT yet a member of.
    return this.prisma.group.findMany({
      where: {
        unitId,
        visibility: 'UNIT_PUBLIC',
        isArchived: false,
        members: { none: { userId } },
      },
      select: {
        id: true,
        name: true,
        description: true,
        type: true,
        visibility: true,
        avatarUrl: true,
        createdAt: true,
        _count: { select: { members: true, messages: true } },
      },
      orderBy: { name: 'asc' },
    })
  }

  async join(unitId: string, groupId: string, userId: string) {
    const group = await this.prisma.group.findFirst({
      where: { id: groupId, unitId, isArchived: false },
      select: { id: true, visibility: true },
    })
    if (!group) throw new NotFoundException('Grupo não encontrado.')
    if (group.visibility !== 'UNIT_PUBLIC') {
      throw new ForbiddenException('Este grupo não aceita adesão livre.')
    }

    return this.prisma.groupMember.upsert({
      where: { groupId_userId: { groupId, userId } },
      update: {},
      create: { groupId, userId, role: 'MEMBER', addedBy: userId },
    })
  }
}
