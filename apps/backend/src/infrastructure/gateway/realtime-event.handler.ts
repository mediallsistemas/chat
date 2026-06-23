import { Injectable } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { AppGateway } from './app.gateway'
import { MeetingCreatedEvent } from '../../contexts/meetings/events/meeting-created.event'
import { MeetingUpdatedEvent } from '../../contexts/meetings/events/meeting-updated.event'
import { MeetingCancelledEvent } from '../../contexts/meetings/events/meeting-cancelled.event'
import { MeetingStartedEvent } from '../../contexts/meetings/events/meeting-started.event'
import { MeetingEndedEvent } from '../../contexts/meetings/events/meeting-ended.event'
import { RecordingConsentRequestedEvent } from '../../contexts/meetings/events/recording-consent-requested.event'
import { RecordingConsentUpdatedEvent } from '../../contexts/meetings/events/recording-consent-updated.event'
import { RecordingStartedEvent } from '../../contexts/meetings/events/recording-started.event'
import { RecordingStoppedEvent } from '../../contexts/meetings/events/recording-stopped.event'
import { MessageSentEvent } from '../../contexts/chat/messages/events/message-sent.event'
import { MessageEditedEvent } from '../../contexts/chat/messages/events/message-edited.event'
import { MessageDeletedEvent } from '../../contexts/chat/messages/events/message-deleted.event'
import { MessageReactionEvent } from '../../contexts/chat/messages/events/message-reaction.event'
import { GroupUpdatedEvent } from '../../contexts/chat/groups/events/group-updated.event'
import { GroupSystemEvent } from '../../contexts/chat/groups/events/group-system-event.event'
import {
  ImpedimentCreatedEvent,
  ImpedimentResolvedEvent,
  ImpedimentEscalatedEvent,
} from '../../shared/events'
import { PhaseCompletedEvent } from '../../contexts/strategic/phases/events/phase-completed.event'
import { PhaseUnlockedEvent } from '../../contexts/strategic/phases/events/phase-unlocked.event'
import { PlanStatusChangedEvent } from '../../contexts/strategic/plans/events/plan-status-changed.event'

@Injectable()
export class RealtimeEventHandler {
  constructor(private gateway: AppGateway) {}

  /**
   * Bridge domain changes that affect the Jarvis panel to a single
   * `dashboard:update` signal per unit (plano 25.6). The frontend coalesces
   * bursts and refetches the consolidated summary / unit cockpit.
   */
  private emitDashboardUpdate(unitId: string, reason: string) {
    this.gateway.emitToUnit(unitId, 'dashboard:update', { reason })
  }

  @OnEvent('impediment.created')
  onImpedimentCreated(event: ImpedimentCreatedEvent) {
    this.emitDashboardUpdate(event.unitId, 'impediment.created')
  }

  @OnEvent('impediment.resolved')
  onImpedimentResolved(event: ImpedimentResolvedEvent) {
    this.emitDashboardUpdate(event.unitId, 'impediment.resolved')
  }

  @OnEvent('impediment.escalated')
  onImpedimentEscalated(event: ImpedimentEscalatedEvent) {
    this.emitDashboardUpdate(event.unitId, 'impediment.escalated')
  }

  @OnEvent('phase.completed')
  onPhaseCompleted(event: PhaseCompletedEvent) {
    this.emitDashboardUpdate(event.unitId, 'phase.completed')
  }

  @OnEvent('phase.unlocked')
  onPhaseUnlocked(event: PhaseUnlockedEvent) {
    this.emitDashboardUpdate(event.unitId, 'phase.unlocked')
  }

  @OnEvent('plan.status_changed')
  onPlanStatusChanged(event: PlanStatusChangedEvent) {
    // Activate/archive/delete a plan → refresh the Jarvis panel for every
    // affected unit (plano 25.6).
    for (const unitId of event.unitIds) {
      this.emitDashboardUpdate(unitId, `plan.${event.action}`)
    }
  }

  @OnEvent('meeting.created')
  onMeetingCreated(event: MeetingCreatedEvent) {
    this.gateway.emitToUnit(event.unitId, 'meeting:created', event.payload)
  }

  @OnEvent('meeting.updated')
  onMeetingUpdated(event: MeetingUpdatedEvent) {
    this.gateway.emitToUnit(event.unitId, 'meeting:updated', event.payload)
  }

  @OnEvent('meeting.cancelled')
  onMeetingCancelled(event: MeetingCancelledEvent) {
    this.gateway.emitToUnit(event.unitId, 'meeting:cancelled', event.payload)
  }

  @OnEvent('meeting.started')
  onMeetingStarted(event: MeetingStartedEvent) {
    this.gateway.emitToUnit(event.unitId, 'meeting:started', event.payload)
  }

  @OnEvent('meeting.ended')
  onMeetingEnded(event: MeetingEndedEvent) {
    this.gateway.emitToUnit(event.unitId, 'meeting:ended', event.payload)
  }

  @OnEvent('meeting.recording_consent_requested')
  onRecordingConsentRequested(event: RecordingConsentRequestedEvent) {
    this.gateway.emitToUnit(event.unitId, 'recording:consent:request', { meetingId: event.meetingId })
  }

  @OnEvent('meeting.recording_consent_updated')
  onRecordingConsentUpdated(event: RecordingConsentUpdatedEvent) {
    this.gateway.emitToUnit(event.unitId, 'recording:consent:update', event.payload)
  }

  @OnEvent('meeting.recording_started')
  onRecordingStarted(event: RecordingStartedEvent) {
    this.gateway.emitToUnit(event.unitId, 'recording:started', { meetingId: event.meetingId })
  }

  @OnEvent('meeting.recording_stopped')
  onRecordingStopped(event: RecordingStoppedEvent) {
    this.gateway.emitToUnit(event.unitId, 'recording:stopped', event.payload)
  }

  @OnEvent('message.sent')
  onMessageSent(event: MessageSentEvent) {
    this.gateway.emitToGroup(event.groupId, 'message:new', event.payload)
  }

  @OnEvent('message.edited')
  onMessageEdited(event: MessageEditedEvent) {
    this.gateway.emitToGroup(event.groupId, 'message:edited', event.payload)
  }

  @OnEvent('message.deleted')
  onMessageDeleted(event: MessageDeletedEvent) {
    this.gateway.emitToGroup(event.groupId, 'message:deleted', event.payload)
  }

  @OnEvent('message.reaction')
  onMessageReaction(event: MessageReactionEvent) {
    this.gateway.emitToGroup(event.groupId, 'message:reaction', event.payload)
  }

  @OnEvent('group.updated')
  onGroupUpdated(event: GroupUpdatedEvent) {
    this.gateway.emitToGroup(event.groupId, 'group:updated', event.payload)
  }

  @OnEvent('group.system_event')
  onGroupSystemEvent(event: GroupSystemEvent) {
    this.gateway.emitToGroup(event.groupId, 'group:system-event', event.payload)
  }
}
