import { DomainEvent } from '../../../shared/events'

export class TaskCompletedEvent extends DomainEvent {
  readonly eventName = 'task.completed'

  constructor(
    public readonly taskId: string,
    public readonly taskTitle: string,
    public readonly unitId: string,
    public readonly boardId: string,
    public readonly completedByUserId: string,
  ) {
    super()
  }
}
