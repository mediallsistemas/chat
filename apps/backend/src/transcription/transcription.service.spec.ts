import { TranscriptionService } from './transcription.service'
import { NotFoundException, BadRequestException } from '@nestjs/common'
import { STREAM_NAMES } from '@mediall/events'

/**
 * Focus: feature flag behaviour (TRANSCRIPTION_SVC_ENABLED).
 *
 * When the flag is on, processTranscript must publish to Redis Streams and
 * NOT call Anthropic. When off, the inline path runs (covered separately
 * by integration tests; here we just assert the branch was taken).
 */

function makeDeps(overrides: { meetingExists?: boolean } = {}) {
  const meeting = {
    id: '11111111-1111-1111-1111-111111111111',
    unitId: '22222222-2222-2222-2222-222222222222',
    title: 'Daily',
    recordingUrl: 'https://minio.local/rec.webm',
    participants: [
      { userId: '33333333-3333-3333-3333-333333333333' },
      { userId: '44444444-4444-4444-4444-444444444444' },
    ],
  }
  const prisma = {
    meeting: {
      findFirst: jest.fn().mockResolvedValue(overrides.meetingExists === false ? null : meeting),
      update: jest.fn().mockResolvedValue(meeting),
    },
  }
  const eventBus = { publish: jest.fn(), publishAll: jest.fn() }
  const streams = { publish: jest.fn().mockResolvedValue('1-0'), getClient: jest.fn() }
  return { prisma, eventBus, streams, meeting }
}

describe('TranscriptionService (feature flag)', () => {
  const ORIGINAL_ENV = process.env.TRANSCRIPTION_SVC_ENABLED

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) delete process.env.TRANSCRIPTION_SVC_ENABLED
    else process.env.TRANSCRIPTION_SVC_ENABLED = ORIGINAL_ENV
  })

  it('dispatches to Redis Stream when TRANSCRIPTION_SVC_ENABLED=true', async () => {
    process.env.TRANSCRIPTION_SVC_ENABLED = 'true'
    const { prisma, eventBus, streams, meeting } = makeDeps()
    const svc = new TranscriptionService(prisma as any, eventBus as any, streams as any)

    const result = await svc.processTranscript(meeting.unitId, meeting.id, 'Hello world transcript', '55555555-5555-5555-5555-555555555555')

    expect(result).toEqual({ status: 'queued', meetingId: meeting.id })
    expect(streams.publish).toHaveBeenCalledTimes(1)
    const [streamName, payload, extra] = streams.publish.mock.calls[0]
    expect(streamName).toBe(STREAM_NAMES.transcription.requested)
    expect(payload).toMatchObject({
      version: '1',
      meetingId: meeting.id,
      unitId: meeting.unitId,
      requestedBy: '55555555-5555-5555-5555-555555555555',
      recordingUrl: meeting.recordingUrl,
    })
    expect(extra).toEqual({ transcript: 'Hello world transcript' })
  })

  it('does not publish to streams when TRANSCRIPTION_SVC_ENABLED=false (would call Anthropic — not tested here)', async () => {
    process.env.TRANSCRIPTION_SVC_ENABLED = 'false'
    const { prisma, eventBus, streams, meeting } = makeDeps()
    const svc = new TranscriptionService(prisma as any, eventBus as any, streams as any)

    // We don't actually want to hit Anthropic; intercept by making prisma reject *after* the flag check
    // succeeds, ensuring we got past the dispatch branch.
    prisma.meeting.findFirst.mockResolvedValueOnce(meeting)
    // Replace anthropic with a stub that throws — this proves the inline path was taken.
    ;(svc as any).anthropic = {
      messages: { create: jest.fn().mockRejectedValue(new Error('would-call-anthropic')) },
    }

    await expect(
      svc.processTranscript(meeting.unitId, meeting.id, 'Hello', 'u1'),
    ).rejects.toThrow('would-call-anthropic')

    expect(streams.publish).not.toHaveBeenCalled()
  })

  it('throws NotFoundException when meeting does not exist', async () => {
    process.env.TRANSCRIPTION_SVC_ENABLED = 'true'
    const { prisma, eventBus, streams } = makeDeps({ meetingExists: false })
    const svc = new TranscriptionService(prisma as any, eventBus as any, streams as any)

    await expect(
      svc.processTranscript(
        '22222222-2222-2222-2222-222222222222',
        '77777777-7777-7777-7777-777777777777',
        'transcript',
        '66666666-6666-6666-6666-666666666666',
      ),
    ).rejects.toThrow(NotFoundException)
  })

  it('throws BadRequestException on empty transcript', async () => {
    process.env.TRANSCRIPTION_SVC_ENABLED = 'true'
    const { prisma, eventBus, streams } = makeDeps()
    const svc = new TranscriptionService(prisma as any, eventBus as any, streams as any)

    await expect(svc.processTranscript('unit-1', 'meet-1', '   ', '66666666-6666-6666-6666-666666666666')).rejects.toThrow(BadRequestException)
  })

  it('uses pending:// placeholder URL when recording URL is missing', async () => {
    process.env.TRANSCRIPTION_SVC_ENABLED = 'true'
    const { prisma, eventBus, streams, meeting } = makeDeps()
    prisma.meeting.findFirst.mockResolvedValueOnce({ ...meeting, recordingUrl: null })
    const svc = new TranscriptionService(prisma as any, eventBus as any, streams as any)

    await svc.processTranscript(meeting.unitId, meeting.id, 'transcript', '66666666-6666-6666-6666-666666666666')

    const [, payload] = streams.publish.mock.calls[0]
    expect(payload.recordingUrl).toBe(`pending://${meeting.id}`)
  })
})
