import { Injectable } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import {
  ImpedimentCreatedEvent,
  ImpedimentEscalatedEvent,
  ImpedimentResolvedEvent,
} from '../../../shared/events'
import { GroupSystemEventService } from '../groups/group-system-event.service'

/**
 * Bridges impediment domain events into ephemeral system notices shown in the
 * chat group that owns the impeded task's Kanban board. Lives in the chat context
 * and only reads other contexts' event payloads — never their services
 * (architecture.md §1/§3). Best-effort: a task without a chat group is a no-op.
 *
 * Phase/task→objective notices (Integração 1) are intentionally NOT handled here:
 * those events carry goalId, not an objectiveId/group link, so there is no
 * reliable target group yet. They require the explicit `objectiveId` group link
 * from Integração 1 first.
 */
@Injectable()
export class ManagementToChatHandler {
  constructor(private system: GroupSystemEventService) {}

  @OnEvent('impediment.created')
  async onImpedimentCreated(e: ImpedimentCreatedEvent) {
    await this.system.emitForTask(e.taskId, e.unitId, {
      tone: 'warning',
      icon: 'alert-triangle',
      text: `Novo impedimento em "${e.taskTitle}".`,
      href: '/impedimentos',
    })
  }

  @OnEvent('impediment.escalated')
  async onImpedimentEscalated(e: ImpedimentEscalatedEvent) {
    await this.system.emitForTask(e.taskId, e.unitId, {
      tone: 'danger',
      icon: 'arrow-up-right',
      text: `Impedimento escalou para o nível ${e.escalationLevel}.`,
      href: '/impedimentos',
    })
  }

  @OnEvent('impediment.resolved')
  async onImpedimentResolved(e: ImpedimentResolvedEvent) {
    await this.system.emitForTask(e.taskId, e.unitId, {
      tone: 'success',
      icon: 'circle-check',
      text: 'Um impedimento foi resolvido.',
      href: '/impedimentos',
    })
  }
}
