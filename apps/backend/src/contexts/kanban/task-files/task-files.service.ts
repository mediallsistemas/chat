import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { FilesService } from '../../../infrastructure/files/files.service'
import { AttachFileDto } from './dto/attach-file.dto'

@Injectable()
export class TaskFilesService {
  constructor(
    private prisma: PrismaService,
    private filesService: FilesService,
  ) {}

  async attach(unitId: string, taskId: string, dto: AttachFileDto, userId: string) {
    await this.assertTaskOwnership(unitId, taskId)
    return this.prisma.taskFile.create({
      data: { taskId, uploadedBy: userId, ...dto },
    })
  }

  async findAll(unitId: string, taskId: string) {
    await this.assertTaskOwnership(unitId, taskId)
    const files = await this.prisma.taskFile.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
    })
    return Promise.all(
      files.map(async (f) => ({
        ...f,
        url: await this.filesService.getSignedUrl(f.fileKey),
      })),
    )
  }

  async remove(unitId: string, taskId: string, fileId: string, userId: string) {
    await this.assertTaskOwnership(unitId, taskId)
    const file = await this.prisma.taskFile.findFirst({
      where: { id: fileId, taskId },
    })
    if (!file) throw new NotFoundException('File not found')
    await this.filesService.delete(file.fileKey)
    await this.prisma.taskFile.delete({ where: { id: fileId } })
  }

  private async assertTaskOwnership(unitId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({ where: { id: taskId, unitId } })
    if (!task) throw new NotFoundException('Task not found')
  }
}
