import { Injectable } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { AppGateway } from './app.gateway'
import { MeetingCreatedEvent } from '../meetings/events/meeting-created.event'
import { MeetingUpdatedEvent } from '../meetings/events/meeting-updated.event'
import { MeetingCancelledEvent } from '../meetings/events/meeting-cancelled.event'
import { MeetingStartedEvent } from '../meetings/events/meeting-started.event'
import { MeetingEndedEvent } from '../meetings/events/meeting-ended.event'
import { RecordingConsentRequestedEvent } from '../meetings/events/recording-consent-requested.event'
import { RecordingConsentUpdatedEvent } from '../meetings/events/recording-consent-updated.event'
import { RecordingStartedEvent } from '../meetings/events/recording-started.event'
import { RecordingStoppedEvent } from '../meetings/events/recording-stopped.event'
import { MessageSentEvent } from '../chat/messages/events/message-sent.event'
import { MessageEditedEvent } from '../chat/messages/events/message-edited.event'
import { MessageDeletedEvent } from '../chat/messages/events/message-deleted.event'
import { MessageReactionEvent } from '../chat/messages/events/message-reaction.event'

@Injectable()
export class RealtimeEventHandler {
  constructor(private gateway: AppGateway) {}

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
}
