import { EventEmitter2 } from '@nestjs/event-emitter'
import { EventBusService } from './event-bus.service'
import { NotifyUserRequested, NotifyManyRequested } from './notification.events'
import { MessagePosted } from './chat.events'
import { TranscriptionCompleted } from './transcription.events'

describe('EventBusService', () => {
  let emitter: EventEmitter2
  let bus: EventBusService

  beforeEach(() => {
    emitter = new EventEmitter2({ wildcard: true, delimiter: '.' })
    bus = new EventBusService(emitter)
  })

  it('emits NotifyUserRequested on its eventName channel', () => {
    const handler = jest.fn()
    emitter.on('notification.notify_user.requested', handler)

    const event = new NotifyUserRequested({
      userId: 'u1',
      type: 'MENTION' as any,
      title: 'Test',
      body: 'Body',
    })
    bus.publish(event)

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler.mock.calls[0][0]).toBe(event)
  })

  it('emits NotifyManyRequested with full payload list', () => {
    const handler = jest.fn()
    emitter.on('notification.notify_many.requested', handler)

    const event = new NotifyManyRequested([
      { userId: 'u1', type: 'MENTION' as any, title: 'A', body: 'A' },
      { userId: 'u2', type: 'MENTION' as any, title: 'B', body: 'B' },
    ])
    bus.publish(event)

    expect(handler).toHaveBeenCalledTimes(1)
    expect((handler.mock.calls[0][0] as NotifyManyRequested).payloads).toHaveLength(2)
  })

  it('publishAll emits every event in order', () => {
    const calls: string[] = []
    emitter.on('chat.message.posted', () => calls.push('chat'))
    emitter.on('transcription.completed', () => calls.push('transcription'))

    bus.publishAll([
      new MessagePosted('m1', 'g1', 'u1', 'unit1'),
      new TranscriptionCompleted('m1', 't1', 'unit1', 'summary'),
    ])

    expect(calls).toEqual(['chat', 'transcription'])
  })

  it('domain events get a unique eventId per instance', () => {
    const a = new NotifyUserRequested({ userId: 'u1', type: 'MENTION' as any, title: 't', body: 'b' })
    const b = new NotifyUserRequested({ userId: 'u1', type: 'MENTION' as any, title: 't', body: 'b' })
    expect(a.eventId).not.toEqual(b.eventId)
  })

  it('does not emit on unrelated channels', () => {
    const other = jest.fn()
    emitter.on('chat.message.posted', other)

    bus.publish(new NotifyUserRequested({ userId: 'u1', type: 'MENTION' as any, title: 't', body: 'b' }))

    expect(other).not.toHaveBeenCalled()
  })
})
