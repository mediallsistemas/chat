export enum MeetingStatus {
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE',
  CANCELLED = 'CANCELLED',
}

export enum ParticipantStatus {
  INVITED = 'INVITED',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
  ATTENDED = 'ATTENDED',
}

export interface MeetingParticipant {
  id: string
  meetingId: string
  userId: string
  status: ParticipantStatus
  joinedAt: string | null
  leftAt: string | null
  user?: { id: string; name: string; avatarUrl: string | null }
}

export interface Meeting {
  id: string
  title: string
  description: string | null
  groupId: string | null
  unitId: string
  createdBy: string
  startAt: string
  endAt: string
  roomId: string
  isRecurring: boolean
  recurrenceRule: string | null
  parentMeetingId: string | null
  status: MeetingStatus
  recordingUrl: string | null
  transcript: string | null
  transcriptSummary: string | null
  transcriptActionItems: TranscriptActionItem[] | null
  transcriptedAt: string | null
  createdAt: string
  updatedAt: string
  participants?: MeetingParticipant[]
  creator?: { id: string; name: string; avatarUrl: string | null }
  group?: { id: string; name: string } | null
  _count?: { participants: number }
}

export interface LiveKitTokenResponse {
  token: string
  wsUrl: string
  roomId: string
}

export type AgendaItemType = 'meeting' | 'task' | 'macro_task' | 'objective'

export interface AgendaItem {
  id: string
  type: AgendaItemType
  title: string
  date: string
  endDate?: string
  status: string
  meta?: Record<string, string>
}

export interface RecordingConsentStatus {
  consentedCount: number
  totalRequired: number
  allConsented: boolean
}

export interface TranscriptActionItem {
  action: string
  owner: string
  deadline?: string
}

export interface TranscriptResult {
  summary: string
  actionItems: TranscriptActionItem[]
  keyDecisions: string[]
  duration?: string
}

export interface MeetingChatMessage {
  id: string
  meetingId: string
  senderId: string
  sender: { id: string; name: string; avatarUrl: string | null }
  content: string
  createdAt: string
}

export interface MeetingChatPage {
  messages: MeetingChatMessage[]
  nextCursor: string | null
}
