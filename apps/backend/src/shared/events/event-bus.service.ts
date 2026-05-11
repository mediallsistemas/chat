import { Injectable } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { DomainEvent } from './domain-event.base'

@Injectable()
export class EventBusService {
  constructor(private emitter: EventEmitter2) {}

  publish(event: DomainEvent): void {
    this.emitter.emit(event.eventName, event)
  }

  publishAll(events: DomainEvent[]): void {
    events.forEach((e) => this.publish(e))
  }
}
