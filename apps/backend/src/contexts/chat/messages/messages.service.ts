import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { FilesService } from '../../files/files.service'
import { NotificationsService } from '../../notifications/notifications.service'
import { EventBusService } from '../../shared/events'
import { MessageSentEvent } from './events/message-sent.event'
import { MessageEditedEvent } from './events/message-edited.event'
import { MessageDeletedEvent } from './events/message-deleted.event'
import { MessageReactionEvent } from './events/message-reaction.event'
import { SendMessageDto, EditMessageDto } from './dto/send-message.dto'
import { JwtPayload, MessageType, NotificationType } from '@mediall/types'

// Mention format: @[T:uuid|Task Title] for tasks, @[O:uuid|Objective Title] for objectives
const MENTION_RE = /@\[([TO]):([a-f0-9-]+)\|[^\]]+\]/g

const PAGE_SIZE = 40

@Injectable()
export class MessagesService {
  constructor(
    private prisma: PrismaService,
    private filesService: FilesService,
    private notifications: NotificationsService,
    private eventBus: EventBusService,
  ) {}

  private async attachFileUrl(msg: Record<string, unknown>) {
    if (msg.fileKey) {
      return { ...msg, fileUrl: await this.filesService.getSignedUrl(msg.fileKey as string) }
    }
    return msg
  }

  async findByGroup(unitId: string, groupId: string, cursor?: string) {
    const take = PAGE_SIZE + 1

    const messages = await this.prisma.message.findMany({
      where: { groupId, group: { unitId }, isDeleted: false },
      orderBy: { createdAt: 'desc' },
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true } },
        replyTo: {
          select: { id: true, content: true, sender: { select: { name: true } } },
        },
        reactions: { select: { emoji: true, userId: true } },
      },
    })

    const hasMore = messages.length > PAGE_SIZE
    const page = (hasMore ? messages.slice(0, PAGE_SIZE) : messages).reverse()
    const withUrls = await Promise.all(page.map((m) => this.attachFileUrl(m as Record<string, unknown>)))

    return {
      messages: withUrls,
      nextCursor: hasMore ? messages[PAGE_SIZE - 1].id : null,
    }
  }

  async send(unitId: string, groupId: string, dto: SendMessageDto, user: JwtPayload) {
    await this.assertMembership(unitId, groupId, user.sub)

    const type = dto.fileKey
      ? dto.fileMime?.startsWith('image/') ? MessageType.IMAGE : MessageType.FILE
      : (dto.type ?? MessageType.TEXT)

    const message = await this.prisma.message.create({
      data: {
        groupId,
        senderId: user.sub,
        content: dto.content,
        type,
        replyToId: dto.replyToId,
        fileKey: dto.fileKey,
        fileName: dto.fileName,
        fileSize: dto.fileSize,
        fileMime: dto.fileMime,
      },
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true } },
        replyTo: {
          select: { id: true, content: true, sender: { select: { name: true } } },
        },
      },
    })

    const enriched = await this.attachFileUrl(message as unknown as Record<string, unknown>)
    this.eventBus.publish(new MessageSentEvent(groupId, unitId, enriched))

    // Parse @mentions and notify mentioned entity owners asynchronously
    this.processMentions(dto.content, user, groupId).catch(() => undefined)

    return enriched
  }

  private async processMentions(content: string, sender: JwtPayload, groupId: string) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      select: { name: true, unitId: true },
    })
    if (!group) return

    const matches = [...content.matchAll(MENTION_RE)]
    for (const [, type, entityId] of matches) {
      let responsibleUserId: string | null = null
      let entityTitle = ''

      if (type === 'T') {
        const task = await this.prisma.task.findFirst({
          where: { id: entityId, unitId: group.unitId },
          select: { responsibleUserId: true, title: true },
        })
        responsibleUserId = task?.responsibleUserId ?? null
        entityTitle = task?.title ?? ''
      } else if (type === 'O') {
        const objective = await this.prisma.objective.findFirst({
          where: { id: entityId, unitId: group.unitId },
          select: { responsibleUserId: true, title: true },
        })
        responsibleUserId = objective?.responsibleUserId ?? null
        entityTitle = objective?.title ?? ''
      }

      if (responsibleUserId && responsibleUserId !== sender.sub) {
        await this.notifications.create({
          userId: responsibleUserId,
          title: `Você foi mencionado em ${group.name}`,
          body: `${sender.name} mencionou "${entityTitle}"`,
          type: NotificationType.MENTION,
          entityType: type === 'T' ? 'task' : 'objective',
          entityId,
          unitId: group.unitId,
        })
      }
    }
  }

  async edit(unitId: string, groupId: string, messageId: string, dto: EditMessageDto, user: JwtPayload) {
    const msg = await this.findMessage(unitId, groupId, messageId)
    if (msg.senderId !== user.sub) throw new ForbiddenException('Você não pode editar esta mensagem.')

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: { content: dto.content, isEdited: true, editedAt: new Date() },
      include: { sender: { select: { id: true, name: true, avatarUrl: true } } },
    })

    this.eventBus.publish(new MessageEditedEvent(groupId, unitId, updated))
    return updated
  }

  async delete(unitId: string, groupId: string, messageId: string, user: JwtPayload) {
    const msg = await this.findMessage(unitId, groupId, messageId)
    if (msg.senderId !== user.sub) throw new ForbiddenException('Você não pode excluir esta mensagem.')

    await this.prisma.message.update({
      where: { id: messageId },
      data: { isDeleted: true, deletedAt: new Date() },
    })

    this.eventBus.publish(new MessageDeletedEvent(groupId, unitId, { id: messageId, groupId }))
    return { ok: true }
  }

  async togglePin(unitId: string, groupId: string, messageId: string) {
    const msg = await this.findMessage(unitId, groupId, messageId)
    return this.prisma.message.update({
      where: { id: messageId },
      data: { isPinned: !msg.isPinned },
    })
  }

  async findPinned(unitId: string, groupId: string) {
    return this.prisma.message.findMany({
      where: { groupId, group: { unitId }, isPinned: true, isDeleted: false },
      include: { sender: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
    })
  }

  async toggleReaction(unitId: string, groupId: string, messageId: string, emoji: string, user: JwtPayload) {
    await this.findMessage(unitId, groupId, messageId)

    const existing = await this.prisma.messageReaction.findUnique({
      where: { messageId_userId_emoji: { messageId, userId: user.sub, emoji } },
    })

    if (existing) {
      await this.prisma.messageReaction.delete({ where: { id: existing.id } })
    } else {
      await this.prisma.messageReaction.create({ data: { messageId, userId: user.sub, emoji } })
    }

    const reactions = await this.prisma.messageReaction.groupBy({
      by: ['emoji'],
      where: { messageId },
      _count: { emoji: true },
    })

    const myReactions = await this.prisma.messageReaction.findMany({
      where: { messageId, userId: user.sub },
      select: { emoji: true },
    })

    const payload = {
      messageId,
      groupId,
      reactions: reactions.map((r) => ({ emoji: r.emoji, count: r._count.emoji })),
      myReactions: myReactions.map((r) => r.emoji),
    }

    this.eventBus.publish(new MessageReactionEvent(groupId, unitId, payload))
    return payload
  }

  private async findMessage(unitId: string, groupId: string, messageId: string) {
    const msg = await this.prisma.message.findFirst({
      where: { id: messageId, groupId, group: { unitId } },
    })
    if (!msg) throw new NotFoundException('Mensagem não encontrada.')
    return msg
  }

  private async assertMembership(unitId: string, groupId: string, userId: string) {
    const member = await this.prisma.groupMember.findFirst({
      where: { groupId, userId, group: { unitId } },
    })
    if (!member) throw new ForbiddenException('Você não é membro deste grupo.')
  }
}
