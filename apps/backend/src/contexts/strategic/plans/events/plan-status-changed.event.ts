import { DomainEvent } from '../../../../shared/events'

export type PlanStatusAction = 'activated' | 'archived' | 'deleted'

/**
 * A plan's lifecycle changed (activated / archived / deleted). Carries every unit
 * the change affects so the realtime bridge can refresh the Jarvis panel for each
 * (plano 25.6). Activate/archive touch a single unit; a general delete touches all
 * units the plan was attached to.
 */
export class PlanStatusChangedEvent extends DomainEvent {
  readonly eventName = 'plan.status_changed'

  constructor(
    public readonly planId: string,
    public readonly unitIds: string[],
    public readonly action: PlanStatusAction,
  ) {
    super()
  }
}
