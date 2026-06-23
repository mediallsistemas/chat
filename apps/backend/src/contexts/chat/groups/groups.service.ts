import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../../prisma/prisma.service'
import { FilesService } from '../../../infrastructure/files/files.service'
import { EventBusService } from '../../../shared/events'
import { CreateGroupDto, AddMemberDto } from './dto/create-group.dto'
import { UpdateGroupDto } from './dto/update-group.dto'
import { UpdateMemberRoleDto } from './dto/update-member-role.dto'
import { GroupUpdatedEvent } from './events/group-updated.event'
import { JwtPayload } from '@mediall/types'

@Injectable()
export class GroupsService {
  constructor(
    private prisma: PrismaService,
    private filesService: FilesService,
    private eventBus: EventBusService,
  ) {}

  /**
   * The group cover is stored as a MinIO object key in `avatarUrl` (bucket is
   * private). Resolve it to a short-lived signed URL for the client. Returns the
   * value untouched if it's already an absolute URL or empty.
   */
  private async resolveAvatar<T extends { avatarUrl: string | null }>(group: T): Promise<T> {
    if (group.avatarUrl && !group.avatarUrl.startsWith('http')) {
      return { ...group, avatarUrl: await this.filesService.getSignedUrl(group.avatarUrl) }
    }
    return group
  }

  /** Throws unless the user is an ADMIN member of the group within the unit. */
  private async assertAdmin(unitId: string, groupId: string, userId: string) {
    const member = await this.prisma.groupMember.findFirst({
      where: { groupId, userId, group: { unitId } },
      select: { role: true },
    })
    if (!member || member.role !== 'ADMIN') {
      throw new ForbiddenException('Somente administradores do grupo podem fazer isso.')
    }
  }

  async findAll(unitId: string, userId: string) {
    // Return groups where the user is a member.
    const groups = await this.prisma.group.findMany({
      where: {
        unitId,
        isArchived: false,
        members: { some: { userId } },
      },
      include: {
        _count: { select: { members: true, messages: true } },
        members: {
          where: { userId },
          select: { role: true, lastReadAt: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    // Unread counts per group for this user: messages newer than the member's
    // lastReadAt, excluding their own messages, system notices and deleted ones.
    // Done in a single batched query to avoid N+1. NULL lastReadAt → all count.
    const groupIds = groups.map((g) => g.id)
    const unreadByGroup = new Map<string, number>()
    if (groupIds.length > 0) {
      const rows = await this.prisma.$queryRaw<{ group_id: string; unread: bigint }[]>`
        SELECT m.group_id, COUNT(*)::bigint AS unread
        FROM chat_messages m
        JOIN chat_group_members gm
          ON gm.group_id = m.group_id AND gm.user_id = ${userId}
        WHERE m.group_id IN (${Prisma.join(groupIds)})
          AND m.is_deleted = false
          AND m.sender_id <> ${userId}
          AND m.type <> 'SYSTEM'
          AND (gm.last_read_at IS NULL OR m.created_at > gm.last_read_at)
        GROUP BY m.group_id
      `
      for (const r of rows) unreadByGroup.set(r.group_id, Number(r.unread))
    }

    // For direct messages (PRIVATE groups) the stored `name` is an internal
    // `direct:<idA>:<idB>` token. Resolve the *other* participant so the UI can
    // show their name instead of the raw id. Done in two batched queries to
    // avoid N+1.
    const directGroupIds = groups.filter((g) => g.type === 'PRIVATE').map((g) => g.id)
    const peerByGroup = new Map<string, { id: string; name: string; avatarUrl: string | null } | null>()
    if (directGroupIds.length > 0) {
      const peerMemberships = await this.prisma.groupMember.findMany({
        where: { groupId: { in: directGroupIds }, userId: { not: userId } },
        select: { groupId: true, userId: true },
      })
      const peerUsers = await this.prisma.user.findMany({
        where: { id: { in: peerMemberships.map((m) => m.userId) } },
        select: { id: true, name: true, avatarUrl: true },
      })
      const userById = new Map(peerUsers.map((u) => [u.id, u]))
      for (const m of peerMemberships) {
        peerByGroup.set(m.groupId, userById.get(m.userId) ?? null)
      }
    }

    // For objective-linked groups (project feed — Integração 1), attach the
    // objective's title and bottom-up progress so the UI can show a mini
    // progress indicator in the group header. Batched to avoid N+1.
    const objectiveIds = Array.from(
      new Set(groups.map((g) => g.objectiveId).filter((id): id is string => !!id)),
    )
    const objectiveById = new Map<string, { id: string; title: string; progressPct: number }>()
    if (objectiveIds.length > 0) {
      const objectives = await this.prisma.objective.findMany({
        where: { id: { in: objectiveIds }, unitId },
        select: { id: true, title: true, progressPct: true },
      })
      for (const o of objectives) {
        objectiveById.set(o.id, { id: o.id, title: o.title, progressPct: Number(o.progressPct) })
      }
    }

    // Resolve the cover image key → signed URL for every group, attach the unread
    // count, the linked objective, and the direct-message peer where applicable.
    return Promise.all(
      groups.map(async (g) => {
        const withAvatar = await this.resolveAvatar(g)
        const objective = g.objectiveId ? objectiveById.get(g.objectiveId) ?? null : null
        const base = { ...withAvatar, unreadCount: unreadByGroup.get(g.id) ?? 0, objective }
        return g.type === 'PRIVATE'
          ? { ...base, directPeer: peerByGroup.get(g.id) ?? null }
          : base
      }),
    )
  }

  /** Marks all messages in a group as read for the user (lastReadAt = now). */
  async markRead(unitId: string, groupId: string, userId: string) {
    const member = await this.prisma.groupMember.findFirst({
      where: { groupId, userId, group: { unitId } },
      select: { id: true },
    })
    if (!member) throw new ForbiddenException('Você não é membro deste grupo.')

    await this.prisma.groupMember.update({
      where: { id: member.id },
      data: { lastReadAt: new Date() },
    })
    return { ok: true }
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

  /**
   * Validates a requested parent group for the organizational tree: it must be a
   * SECTOR group in the same unit and not the group itself (no self-parenting).
   * The tree is one level deep / purely visual, so we don't allow a SUBSECTOR to
   * be a parent. Throws on invalid input; returns the normalized parentId (or
   * null when clearing).
   */
  private async resolveParentId(
    unitId: string,
    groupId: string,
    parentId: string | null | undefined,
  ): Promise<string | null> {
    if (!parentId) return null // '' or null clears the parent
    if (parentId === groupId) {
      throw new ForbiddenException('Um grupo não pode ser pai de si mesmo.')
    }
    const parent = await this.prisma.group.findFirst({
      where: { id: parentId, unitId, isArchived: false },
      select: { type: true },
    })
    if (!parent) throw new NotFoundException('Setor pai não encontrado.')
    if (parent.type !== 'SECTOR') {
      throw new ForbiddenException('O grupo pai precisa ser um Setor.')
    }
    return parentId
  }

  /** Edit group identity/settings. Only a group ADMIN may do this. */
  async updateGroup(unitId: string, groupId: string, dto: UpdateGroupDto, user: JwtPayload) {
    await this.assertAdmin(unitId, groupId, user.sub)

    // Resolve/validate the parent sector only when the field is present in the DTO.
    const parentId =
      dto.parentId !== undefined
        ? await this.resolveParentId(unitId, groupId, dto.parentId)
        : undefined

    const group = await this.prisma.group.update({
      where: { id: groupId },
      data: {
        name: dto.name,
        description: dto.description,
        // Store the MinIO key; resolveAvatar() turns it into a signed URL on read.
        ...(dto.avatarKey !== undefined ? { avatarUrl: dto.avatarKey } : {}),
        onlyAdminsPost: dto.onlyAdminsPost,
        visibility: dto.visibility,
        ...(parentId !== undefined ? { parentId } : {}),
      },
    })

    const resolved = await this.resolveAvatar(group)
    this.eventBus.publish(new GroupUpdatedEvent(groupId, unitId, resolved))
    return resolved
  }

  /** Promote/demote a member's role. Guards against removing the last admin. */
  async updateMemberRole(
    unitId: string,
    groupId: string,
    targetUserId: string,
    dto: UpdateMemberRoleDto,
    user: JwtPayload,
  ) {
    await this.assertAdmin(unitId, groupId, user.sub)

    if (dto.role !== 'ADMIN') {
      const target = await this.prisma.groupMember.findFirst({
        where: { groupId, userId: targetUserId, group: { unitId } },
        select: { role: true },
      })
      if (!target) throw new NotFoundException('Membro não encontrado.')
      if (target.role === 'ADMIN') {
        const adminCount = await this.prisma.groupMember.count({
          where: { groupId, role: 'ADMIN', group: { unitId } },
        })
        if (adminCount <= 1) {
          throw new ForbiddenException('O grupo precisa de ao menos um administrador.')
        }
      }
    }

    const member = await this.prisma.groupMember.update({
      where: { groupId_userId: { groupId, userId: targetUserId } },
      data: { role: dto.role },
    })

    this.eventBus.publish(new GroupUpdatedEvent(groupId, unitId, { id: groupId }))
    return member
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
