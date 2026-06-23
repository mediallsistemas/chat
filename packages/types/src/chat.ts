export enum GroupType {
  GENERAL = 'GENERAL',
  SECTOR = 'SECTOR',
  SUBSECTOR = 'SUBSECTOR',
  PROJECT = 'PROJECT',
  TEMPORARY = 'TEMPORARY',
  PRIVATE = 'PRIVATE',
}

export enum GroupVisibility {
  PRIVATE_INVITE = 'PRIVATE_INVITE',
  UNIT_PUBLIC = 'UNIT_PUBLIC',
}

export enum GroupMemberRole {
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
  VIEWER = 'VIEWER',
}

export enum MessageType {
  TEXT = 'TEXT',
  FILE = 'FILE',
  IMAGE = 'IMAGE',
  SYSTEM = 'SYSTEM',
}

export interface Group {
  id: string
  name: string
  description: string | null
  type: GroupType
  visibility: GroupVisibility
  /** Parent SECTOR group in the organizational tree (SUBSECTOR → SECTOR). Visual only. */
  parentId: string | null
  /** Linked strategic objective (project feed). Null when the group tracks none. */
  objectiveId: string | null
  unitId: string
  createdBy: string
  isArchived: boolean
  onlyAdminsPost: boolean
  archiveAt: string | null
  kanbanBoardId: string
  /** Cover image. Backend resolves the stored MinIO key to a signed URL on read. */
  avatarUrl: string | null
  /** Unread messages for the current user (newer than their lastReadAt). */
  unreadCount?: number
  /**
   * Linked objective with its bottom-up progress, when `objectiveId` is set —
   * resolved by the backend so the group header can show a mini progress bar.
   */
  objective?: { id: string; title: string; progressPct: number } | null
  _count?: { members: number; messages: number }
  members?: GroupMember[]
  /**
   * For direct messages (PRIVATE groups): the other participant, resolved by the
   * backend so the UI can show their name instead of the internal `direct:<id>:<id>`
   * group name. Null if the peer could not be resolved.
   */
  directPeer?: { id: string; name: string; avatarUrl: string | null } | null
}

export interface DiscoverableGroup {
  id: string
  name: string
  description: string | null
  type: GroupType
  visibility: GroupVisibility
  avatarUrl: string | null
  createdAt: string
  _count: { members: number; messages: number }
}

export interface GroupMember {
  id: string
  groupId: string
  userId: string
  role: GroupMemberRole
  joinedAt: string
  addedBy: string
}

export interface MessageSender {
  id: string
  name: string
  avatarUrl: string | null
}

export interface MessageReactionItem {
  emoji: string
  userId: string
}

export interface MessageReactionSummary {
  messageId: string
  groupId: string
  reactions: Array<{ emoji: string; count: number }>
  myReactions: string[]
}

export interface Message {
  id: string
  groupId: string
  senderId: string
  sender: MessageSender
  content: string
  type: MessageType
  replyToId: string | null
  replyTo?: { id: string; content: string; sender: { name: string } } | null
  fileKey: string | null
  fileName: string | null
  fileSize: number | null
  fileMime: string | null
  fileUrl?: string | null
  isPinned: boolean
  isEdited: boolean
  isDeleted: boolean
  createdAt: string
  editedAt: string | null
  reactions?: MessageReactionItem[]
  _count?: { replies: number }
  /**
   * Client-only flag: set while an optimistic message is awaiting the server
   * round-trip. Never sent by the backend. Used by the chat UI to render a
   * "enviando…" state and to reconcile the temporary id with the real one.
   */
  pending?: boolean
  /** Client-only flag: optimistic send failed (kept for retry/feedback). */
  failed?: boolean
}

export interface ThreadView {
  parent: Message
  replies: Message[]
}

/** Payload to edit a group's identity/settings (PATCH /groups/:id). */
export interface UpdateGroupInput {
  name?: string
  description?: string
  /** MinIO key returned by POST /upload; backend resolves it to a signed cover URL. */
  avatarKey?: string
  onlyAdminsPost?: boolean
  visibility?: GroupVisibility
  /** Parent SECTOR group id; `null`/'' clears it. Only valid for SUBSECTOR groups. */
  parentId?: string | null
}

export interface MessageBookmark {
  id: string
  userId: string
  messageId: string
  unitId: string
  createdAt: string
  message: Message & {
    group: { id: string; name: string; type: GroupType }
  }
}

export interface BookmarksPage {
  bookmarks: MessageBookmark[]
  nextCursor: string | null
}

export interface CustomEmoji {
  id: string
  unitId: string
  shortcode: string
  fileKey: string
  createdBy: string
  createdAt: string
  url: string
}

export interface ChatReminder {
  id: string
  userId: string
  unitId: string
  groupId: string | null
  text: string
  remindAt: string
  fired: boolean
  createdAt: string
}

export interface Huddle {
  id: string
  groupId: string
  unitId: string
  startedBy: string
  startedAt: string
  endedAt: string | null
  livekitRoomId: string
  participantCount: number
}

export interface HuddleTokenResponse {
  huddleId: string
  groupId: string
  roomId: string
  token: string
  wsUrl: string
  participantCount: number
  /** ISO timestamp of when the call started — used to show the running call timer. */
  startedAt: string
}

export interface ChatSearchResult {
  id: string
  groupId: string
  groupName: string
  senderId: string
  senderName: string
  senderAvatarUrl: string | null
  content: string
  /** Snippet com `<mark>…</mark>` no termo destacado. Não confiar no HTML — sanitize antes de renderizar. */
  headline: string
  rank: number
  createdAt: string
}

export interface ChatSearchPage {
  results: ChatSearchResult[]
  nextCursor: string | null
}
