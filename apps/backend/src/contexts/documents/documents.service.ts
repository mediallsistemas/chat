import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { randomUUID } from 'crypto'
import { PrismaService } from '../../prisma/prisma.service'
import { FilesService } from '../../infrastructure/files/files.service'
import { CreateFolderDto } from './dto/create-folder.dto'
import { JwtPayload } from '@mediall/types'

interface MulterFile {
  originalname: string
  mimetype: string
  buffer: Buffer
  size: number
}

@Injectable()
export class DocumentsService {
  constructor(
    private prisma: PrismaService,
    private files: FilesService,
  ) {}

  async listFolders(unitId: string) {
    return this.prisma.documentFolder.findMany({
      where: { unitId },
      include: { _count: { select: { documents: true, children: true } } },
      orderBy: { name: 'asc' },
    })
  }

  async createFolder(unitId: string, dto: CreateFolderDto, user: JwtPayload) {
    if (dto.parentId) {
      const parent = await this.prisma.documentFolder.findFirst({ where: { id: dto.parentId, unitId } })
      if (!parent) throw new NotFoundException('Pasta pai não encontrada.')
    }
    return this.prisma.documentFolder.create({
      data: { name: dto.name, parentId: dto.parentId ?? null, unitId, createdBy: user.sub },
    })
  }

  async deleteFolder(unitId: string, folderId: string) {
    const folder = await this.prisma.documentFolder.findFirst({ where: { id: folderId, unitId } })
    if (!folder) throw new NotFoundException('Pasta não encontrada.')
    await this.prisma.documentFolder.delete({ where: { id: folderId } })
  }

  async listDocuments(unitId: string, folderId?: string) {
    const docs = await this.prisma.document.findMany({
      where: { unitId, folderId: folderId ?? null },
      include: { uploader: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    })

    return Promise.all(
      docs.map(async (doc) => ({
        ...doc,
        signedUrl: await this.files.getSignedUrl(doc.fileKey),
      })),
    )
  }

  async uploadDocument(
    unitId: string,
    folderId: string | null,
    file: MulterFile,
    name: string,
    description: string | undefined,
    user: JwtPayload,
  ) {
    const ext = file.originalname.split('.').pop() ?? 'bin'
    const fileKey = `${unitId}/docs/${randomUUID()}.${ext}`
    await this.files.upload(fileKey, file.buffer, file.mimetype)

    return this.prisma.document.create({
      data: {
        name,
        description: description ?? null,
        folderId,
        unitId,
        fileKey,
        fileName: file.originalname,
        fileSize: file.size,
        fileMime: file.mimetype,
        uploadedBy: user.sub,
      },
      include: { uploader: { select: { id: true, name: true } } },
    })
  }

  async deleteDocument(unitId: string, documentId: string, user: JwtPayload) {
    const doc = await this.prisma.document.findFirst({ where: { id: documentId, unitId } })
    if (!doc) throw new NotFoundException('Documento não encontrado.')

    const userUnit = await this.prisma.userUnit.findFirst({
      where: { userId: user.sub, unitId },
      select: { role: true },
    })
    const canDelete =
      doc.uploadedBy === user.sub ||
      (userUnit?.role && ['SUPER_ADMIN', 'DIRETORIA', 'GESTOR'].includes(userUnit.role))

    if (!canDelete) throw new ForbiddenException('Sem permissão para excluir este documento.')

    await this.files.delete(doc.fileKey)
    await this.prisma.document.delete({ where: { id: documentId } })
  }
}
