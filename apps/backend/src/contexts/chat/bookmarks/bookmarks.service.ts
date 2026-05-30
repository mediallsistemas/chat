import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { FilesService } from '../../../infrastructure/files/files.service'
import { JwtPayload } from '@mediall/types'

const PAGE_SIZE = 40

@Injectable()
export class BookmarksService {
  constructor(
    private prisma: PrismaService,
    private filesService: FilesService,
  ) {}

  async create(unitId: string, messageId: string, user: JwtPayload) {
    const message = await this.prisma.message.findFirst({
      where: { id: messageId, isDeleted: false, group: { unitId } },
      select: { id: true, groupId: true, group: { select: { unitId: true } } },
    })
    if (!message) throw new NotFoundException('Mensagem não encontrada.')

    const member = await this.prisma.groupMember.findFirst({
      where: { groupId: message.groupId, userId: user.sub },
      select: { id: true },
    })
    if (!member) throw new ForbiddenException('Você não é membro deste grupo.')

    try {
      return await this.prisma.messageBookmark.create({
        data: { userId: user.sub, messageId, unitId },
      })
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') {
        throw new ConflictException('Mensagem já está salva.')
      }
      throw err
    }
  }

  async delete(unitId: string, messageId: string, user: JwtPayload) {
    const existing = await this.prisma.messageBookmark.findFirst({
      where: { userId: user.sub, messageId, unitId },
      select: { id: true },
    })
    if (!existing) throw new NotFoundException('Marcador não encontrado.')

    await this.prisma.messageBookmark.delete({ where: { id: existing.id } })
    return { ok: true }
  }

  async findAll(unitId: string, user: JwtPayload, cursor?: string) {
    const take = PAGE_SIZE + 1
    const bookmarks = await this.prisma.messageBookmark.findMany({
      where: { userId: user.sub, unitId },
      orderBy: { createdAt: 'desc' },
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        message: {
          include: {
            sender: { select: { id: true, name: true, avatarUrl: true } },
            group: { select: { id: true, name: true, type: true } },
          },
        },
      },
    })

    const hasMore = bookmarks.length > PAGE_SIZE
    const page = hasMore ? bookmarks.slice(0, PAGE_SIZE) : bookmarks

    const enriched = await Promise.all(
      page.map(async (b) => ({
        ...b,
        message: b.message.fileKey
          ? { ...b.message, fileUrl: await this.filesService.getSignedUrl(b.message.fileKey) }
          : b.message,
      })),
    )

    return {
      bookmarks: enriched,
      nextCursor: hasMore ? page[page.length - 1].id : null,
    }
  }
}
