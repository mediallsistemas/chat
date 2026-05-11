export abstract class DomainEvent {
  readonly occurredAt: Date = new Date()
  readonly eventId: string = crypto.randomUUID()
  abstract readonly eventName: string
}
