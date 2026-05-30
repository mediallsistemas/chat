import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common'
import { randomUUID } from 'crypto'
import { PrismaService } from '../../../prisma/prisma.service'
import { FilesService } from '../../../infrastructure/files/files.service'
import { JwtPayload } from '@mediall/types'

const ALLOWED_MIME = ['image/png', 'image/gif', 'image/webp']
const MAX_BYTES = 256 * 1024 // 256 KB — emojis devem ser pequenos

@Injectable()
export class CustomEmojisService {
  constructor(
    private prisma: PrismaService,
    private filesService: FilesService,
  ) {}

  async findAll(unitId: string) {
    const emojis = await this.prisma.customEmoji.findMany({
      where: { unitId },
      orderBy: { shortcode: 'asc' },
    })

    return Promise.all(
      emojis.map(async (e) => ({
        ...e,
        url: await this.filesService.getSignedUrl(e.fileKey),
      })),
    )
  }

  async create(
    unitId: string,
    shortcode: string,
    file: { buffer: Buffer; mimetype: string; size: number },
    user: JwtPayload,
  ) {
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      throw new BadRequestException('Apenas PNG, GIF ou WebP são aceitos.')
    }
    if (file.size > MAX_BYTES) {
      throw new BadRequestException('Arquivo deve ter no máximo 256 KB.')
    }

    const existing = await this.prisma.customEmoji.findUnique({
      where: { unitId_shortcode: { unitId, shortcode } },
    })
    if (existing) {
      throw new ConflictException('Já existe um emoji com este shortcode nesta unidade.')
    }

    const ext = file.mimetype === 'image/gif' ? 'gif' : file.mimetype === 'image/webp' ? 'webp' : 'png'
    const fileKey = `${unitId}/custom-emojis/${randomUUID()}.${ext}`
    await this.filesService.upload(fileKey, file.buffer, file.mimetype)

    const emoji = await this.prisma.customEmoji.create({
      data: { unitId, shortcode, fileKey, createdBy: user.sub },
    })

    return { ...emoji, url: await this.filesService.getSignedUrl(fileKey) }
  }

  async delete(unitId: string, id: string) {
    const emoji = await this.prisma.customEmoji.findFirst({ where: { id, unitId } })
    if (!emoji) throw new NotFoundException('Emoji não encontrado.')

    await this.prisma.customEmoji.delete({ where: { id } })
    await this.filesService.delete(emoji.fileKey)
    return { ok: true }
  }
}
