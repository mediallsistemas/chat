import { Injectable, BadRequestException } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bull'
import { Queue } from 'bull'
import { PrismaService } from '../../../prisma/prisma.service'
import { CreateReminderDto } from './dto/create-reminder.dto'
import { JwtPayload } from '@mediall/types'

const MAX_DELAY_MS = 90 * 24 * 60 * 60 * 1000 // 90 dias

export interface ReminderJobData {
  reminderId: string
}

@Injectable()
export class RemindersService {
  constructor(
    private prisma: PrismaService,
    @InjectQueue('chat-reminders') private remindersQueue: Queue<ReminderJobData>,
  ) {}

  async create(unitId: string, dto: CreateReminderDto, user: JwtPayload) {
    const remindAt = new Date(dto.remindAt)
    const delay = remindAt.getTime() - Date.now()

    if (delay <= 0) {
      throw new BadRequestException('A data do lembrete deve estar no futuro.')
    }
    if (delay > MAX_DELAY_MS) {
      throw new BadRequestException('Lembrete não pode ser agendado para mais de 90 dias no futuro.')
    }

    const reminder = await this.prisma.chatReminder.create({
      data: {
        userId: user.sub,
        unitId,
        groupId: dto.groupId,
        text: dto.text,
        remindAt,
      },
    })

    const job = await this.remindersQueue.add(
      'fire-reminder',
      { reminderId: reminder.id },
      {
        delay,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    )

    await this.prisma.chatReminder.update({
      where: { id: reminder.id },
      data: { jobId: String(job.id) },
    })

    return { ...reminder, jobId: String(job.id) }
  }

  async findUpcoming(unitId: string, user: JwtPayload) {
    return this.prisma.chatReminder.findMany({
      where: { userId: user.sub, unitId, fired: false, remindAt: { gt: new Date() } },
      orderBy: { remindAt: 'asc' },
      take: 20,
    })
  }

  async cancel(unitId: string, id: string, user: JwtPayload) {
    const reminder = await this.prisma.chatReminder.findFirst({
      where: { id, userId: user.sub, unitId, fired: false },
    })
    if (!reminder) throw new BadRequestException('Lembrete não encontrado.')

    if (reminder.jobId) {
      const job = await this.remindersQueue.getJob(reminder.jobId)
      if (job) await job.remove()
    }

    await this.prisma.chatReminder.delete({ where: { id } })
    return { ok: true }
  }
}
