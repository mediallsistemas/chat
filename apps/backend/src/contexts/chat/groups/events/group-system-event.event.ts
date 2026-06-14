import { DomainEvent } from '../../../../shared/events'

/**
 * An ephemeral, non-persisted system notice to be shown inline in a group's
 * timeline (e.g. "impediment escalated", "phase completed"). The realtime bridge
 * forwards it to the group's socket room as `group:system-event`. It is NOT
 * stored as a Message — it disappears on refresh by design.
 */
export class GroupSystemEvent extends DomainEvent {
  readonly eventName = 'group.system_event'

  constructor(
    public readonly groupId: string,
    public readonly payload: {
      /** Visual tone of the banner. */
      tone: 'info' | 'success' | 'warning' | 'danger'
      /** Tabler icon name without the `ti-` prefix (e.g. 'flag', 'alert-triangle'). */
      icon: string
      /** Human-facing text (Portuguese). */
      text: string
      /** Optional deep-link path inside the app (e.g. '/impedimentos'). */
      href?: string
    },
  ) {
    super()
  }
}
