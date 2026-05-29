import Anthropic from '@anthropic-ai/sdk'
import { TranscriptionRequested } from '@mediall/events'
import { config } from './config'
import { logger } from './logger'
import { fetchMeeting } from './monolith-client'
import {
  publishTranscriptionCompleted,
  publishTranscriptionFailed,
  publishNotifyUser,
} from './stream-publisher'

const anthropic = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY })

interface AnalysisResult {
  summary: string
  keyDecisions: string[]
  actionItems: { action: string; owner: string | null; deadline: string | null }[]
}

const FALLBACK: AnalysisResult = {
  summary: 'Não foi possível processar a transcrição automaticamente.',
  keyDecisions: [],
  actionItems: [],
}

async function downloadRecording(url: string): Promise<string> {
  /* Recording URL is signed by MinIO. In a future iteration we'd stream the
   * audio file to Anthropic's audio endpoints. For now the monolith already
   * has the text transcript and passes it via the request payload — but the
   * cross-service contract leaves room to pass a URL for future audio→text. */
  return url
}

async function analyzeTranscript(meetingTitle: string, transcript: string): Promise<AnalysisResult> {
  const response = await anthropic.messages.create({
    model: config.ANTHROPIC_MODEL,
    max_tokens: 2000,
    system: `Você é um assistente especializado em análise de reuniões corporativas.
Analise a transcrição fornecida e extraia as informações de forma estruturada em JSON.
Responda APENAS com JSON válido, sem explicações adicionais.`,
    messages: [
      {
        role: 'user',
        content: `Analise esta transcrição de reunião intitulada "${meetingTitle}" e responda com JSON:
{
  "summary": "Resumo executivo em 3-5 frases",
  "keyDecisions": ["Decisão 1", "Decisão 2"],
  "actionItems": [
    { "action": "Descrição", "owner": "Nome ou null", "deadline": "Prazo ou null" }
  ]
}

Transcrição:
${transcript.substring(0, 12000)}`,
      },
    ],
  })

  try {
    const block = response.content[0]
    if (block.type !== 'text') return FALLBACK
    const jsonMatch = block.text.match(/\{[\s\S]*\}/)
    return JSON.parse(jsonMatch ? jsonMatch[0] : block.text) as AnalysisResult
  } catch (err) {
    logger.warn({ err }, 'failed to parse anthropic response, returning fallback')
    return FALLBACK
  }
}

export async function processTranscription(event: TranscriptionRequested, rawTranscript: string) {
  const ctx = { meetingId: event.meetingId, eventId: event.eventId }
  logger.info(ctx, 'processing transcription request')

  const meeting = await fetchMeeting(event.meetingId)
  if (!meeting) {
    logger.error(ctx, 'meeting not found in monolith')
    await publishTranscriptionFailed({
      meetingId: event.meetingId,
      unitId: event.unitId,
      reason: 'MEETING_NOT_FOUND',
      errorCode: '404',
    })
    return
  }

  await downloadRecording(event.recordingUrl)

  try {
    const analysis = await analyzeTranscript(meeting.title, rawTranscript)

    await publishTranscriptionCompleted({
      meetingId: meeting.id,
      unitId: meeting.unitId,
      transcript: rawTranscript,
      summary: analysis.summary,
      keyDecisions: analysis.keyDecisions,
      actionItems: analysis.actionItems,
    })

    const notifyTargets = meeting.participantUserIds.filter((id) => id !== event.requestedBy)
    for (const userId of notifyTargets) {
      await publishNotifyUser({
        userId,
        unitId: meeting.unitId,
        type: 'TRANSCRIPT_READY',
        title: 'Transcrição disponível',
        body: `A transcrição da reunião "${meeting.title}" foi processada com IA e está disponível.`,
        entityType: 'meeting',
        entityId: meeting.id,
      })
    }

    logger.info(ctx, 'transcription completed')
  } catch (err) {
    logger.error({ ...ctx, err }, 'transcription analysis failed')
    await publishTranscriptionFailed({
      meetingId: meeting.id,
      unitId: meeting.unitId,
      reason: err instanceof Error ? err.message : String(err),
    })
  }
}
