import { DomainEvent } from '../../../shared/events'

export class TaskCreatedEvent extends DomainEvent {
  readonly eventName = 'task.created'

  constructor(
    public readonly taskId: string,
    public readonly taskTitle: string,
    public readonly unitId: string,
    public readonly boardId: string,
    public readonly responsibleUserId: string | null,
    public readonly createdByUserId: string,
  ) {
    super()
  }
}
