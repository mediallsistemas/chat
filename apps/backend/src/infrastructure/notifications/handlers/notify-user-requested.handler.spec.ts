import { NotifyUserRequestedHandler } from './notify-user-requested.handler'
import { NotifyUserRequested, NotifyManyRequested } from '../../../shared/events'
import { NotificationsService } from '../notifications.service'

describe('NotifyUserRequestedHandler', () => {
  let notifications: jest.Mocked<Pick<NotificationsService, 'create' | 'notifyMany'>>
  let handler: NotifyUserRequestedHandler

  beforeEach(() => {
    notifications = {
      create: jest.fn().mockResolvedValue({ id: 'n1' }),
      notifyMany: jest.fn().mockResolvedValue(undefined),
    }
    handler = new NotifyUserRequestedHandler(notifications as unknown as NotificationsService)
  })

  it('forwards NotifyUserRequested payload to NotificationsService.create', async () => {
    const event = new NotifyUserRequested({
      userId: 'u1',
      unitId: 'unit1',
      type: 'MENTION' as any,
      title: 'Test',
      body: 'Body',
    })

    await handler.onNotifyUser(event)

    expect(notifications.create).toHaveBeenCalledTimes(1)
    expect(notifications.create).toHaveBeenCalledWith(event.payload)
  })

  it('forwards NotifyManyRequested batch to NotificationsService.notifyMany', async () => {
    const event = new NotifyManyRequested([
      { userId: 'u1', type: 'MENTION' as any, title: 'A', body: 'A' },
      { userId: 'u2', type: 'MENTION' as any, title: 'B', body: 'B' },
    ])

    await handler.onNotifyMany(event)

    expect(notifications.notifyMany).toHaveBeenCalledTimes(1)
    expect(notifications.notifyMany).toHaveBeenCalledWith(event.payloads)
  })

  it('swallows errors from create — failures must not break the publisher', async () => {
    notifications.create.mockRejectedValueOnce(new Error('boom'))

    await expect(
      handler.onNotifyUser(
        new NotifyUserRequested({
          userId: 'u1',
          type: 'MENTION' as any,
          title: 't',
          body: 'b',
        }),
      ),
    ).resolves.toBeUndefined()
  })

  it('swallows errors from notifyMany — failures must not break the publisher', async () => {
    notifications.notifyMany.mockRejectedValueOnce(new Error('boom'))

    await expect(
      handler.onNotifyMany(
        new NotifyManyRequested([{ userId: 'u1', type: 'MENTION' as any, title: 't', body: 'b' }]),
      ),
    ).resolves.toBeUndefined()
  })
})
