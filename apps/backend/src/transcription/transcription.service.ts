import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common'
import Anthropic from '@anthropic-ai/sdk'
import { randomUUID } from 'crypto'
import { PrismaService } from '../prisma/prisma.service'
import { EventBusService, NotifyManyRequested, TranscriptionCompleted } from '../shared/events'
import { NotificationType } from '@mediall/types'
import { RedisStreamsPublisher } from '../shared/streams/redis-streams.service'
import { STREAM_NAMES, TranscriptionRequestedSchema } from '@mediall/events'

@Injectable()
export class TranscriptionService {
  private readonly logger = new Logger(TranscriptionService.name)
  private anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  // Keep the inline (rollback) path in sync with transcription-svc, which reads
  // the same env var — otherwise a model override silently fails to apply here.
  private readonly anthropicModel = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6'
  private readonly useExternalSvc = process.env.TRANSCRIPTION_SVC_ENABLED === 'true'

  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
    private streams: RedisStreamsPublisher,
  ) {}

  async processTranscript(
    unitId: string,
    meetingId: string,
    transcript: string,
    userId: string,
  ) {
    const meeting = await this.prisma.meeting.findFirst({
      where: { id: meetingId, unitId },
      include: { participants: { select: { userId: true } } },
    })

    if (!meeting) throw new NotFoundException('Reunião não encontrada.')
    if (!transcript.trim()) throw new BadRequestException('Transcrição não pode estar vazia.')

    /* Plano 17, Fase 2: when TRANSCRIPTION_SVC_ENABLED=true, dispatch the
     * work to transcription-svc via Redis Streams instead of processing
     * inline. Result comes back via TranscriptionCompleted stream — see
     * transcription-stream.handler.ts. */
    if (this.useExternalSvc) {
      const event = {
        version: '1' as const,
        eventId: randomUUID(),
        occurredAt: new Date().toISOString(),
        meetingId,
        recordingUrl: meeting.recordingUrl ?? `pending://${meetingId}`,
        unitId,
        requestedBy: userId,
      }
      TranscriptionRequestedSchema.parse(event)
      await this.streams.publish(STREAM_NAMES.transcription.requested, event, { transcript })
      this.logger.log(`transcription dispatched to svc meeting=${meetingId}`)
      return { status: 'queued', meetingId }
    }

    // Use Claude API to extract structured insights from the transcript
    const response = await this.anthropic.messages.create({
      model: this.anthropicModel,
      max_tokens: 2000,
      system: `Você é um assistente especializado em análise de reuniões corporativas.
Analise a transcrição fornecida e extraia as informações de forma estruturada em JSON.
Responda APENAS com JSON válido, sem explicações adicionais.`,
      messages: [
        {
          role: 'user',
          content: `Analise esta transcrição de reunião intitulada "${meeting.title}" e responda com JSON no seguinte formato:
{
  "summary": "Resumo executivo da reunião em 3-5 frases",
  "keyDecisions": ["Decisão 1", "Decisão 2"],
  "actionItems": [
    { "action": "Descrição da ação", "owner": "Nome do responsável", "deadline": "Prazo se mencionado" }
  ]
}

Transcrição:
${transcript.substring(0, 12000)}`,
        },
      ],
    })

    let parsed: { summary: string; keyDecisions: string[]; actionItems: { action: string; owner: string; deadline?: string }[] }
    try {
      const content = response.content[0]
      if (content.type !== 'text') throw new Error('Unexpected response type')
      const jsonMatch = content.text.match(/\{[\s\S]*\}/)
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content.text)
    } catch {
      parsed = { summary: 'Não foi possível processar a transcrição automaticamente.', keyDecisions: [], actionItems: [] }
    }

    const updated = await this.prisma.meeting.update({
      where: { id: meetingId },
      data: {
        transcript,
        transcriptSummary: parsed.summary,
        transcriptActionItems: { summary: parsed.summary, keyDecisions: parsed.keyDecisions, actionItems: parsed.actionItems },
        transcriptedAt: new Date(),
      },
    })

    // Publish completion event — handlers (notifications, etc.) reagem ao evento
    this.eventBus.publish(new TranscriptionCompleted(meetingId, meetingId, unitId, parsed.summary))

    const participantIds = meeting.participants.map((p) => p.userId).filter((id) => id !== userId)
    if (participantIds.length > 0) {
      this.eventBus.publish(
        new NotifyManyRequested(
          participantIds.map((id) => ({
            userId: id,
            unitId,
            type: NotificationType.TRANSCRIPT_READY as any,
            title: 'Transcrição disponível',
            body: `A transcrição da reunião "${meeting.title}" foi processada com IA e está disponível.`,
            entityType: 'meeting',
            entityId: meetingId,
          })),
        ),
      )
    }

    return { meeting: updated, analysis: parsed }
  }

  async getTranscript(unitId: string, meetingId: string) {
    const meeting = await this.prisma.meeting.findFirst({
      where: { id: meetingId, unitId },
      select: {
        id: true,
        title: true,
        transcript: true,
        transcriptSummary: true,
        transcriptActionItems: true,
        transcriptedAt: true,
      },
    })
    if (!meeting) throw new NotFoundException('Reunião não encontrada.')
    return meeting
  }
}
