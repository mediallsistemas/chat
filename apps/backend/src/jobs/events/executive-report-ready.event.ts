import { DomainEvent } from '../../shared/events'

export interface ExecutiveReportPayload {
  activePlans: number
  openImpediments: number
  blockedTasks: number
  completedThisWeek: number
}

export class ExecutiveReportReadyEvent extends DomainEvent {
  readonly eventName = 'report.executive_ready'

  constructor(
    public readonly recipientIds: Array<{ userId: string; email: string; name: string }>,
    public readonly report: ExecutiveReportPayload,
  ) {
    super()
  }
}
