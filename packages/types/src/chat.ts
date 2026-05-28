export enum GroupType {
  GENERAL = 'GENERAL',
  SECTOR = 'SECTOR',
  SUBSECTOR = 'SUBSECTOR',
  PROJECT = 'PROJECT',
  TEMPORARY = 'TEMPORARY',
  PRIVATE = 'PRIVATE',
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
  parentId: string | null
  unitId: string
  createdBy: string
  isArchived: boolean
  onlyAdminsPost: boolean
  archiveAt: string | null
  kanbanBoardId: string
  _count?: { members: number; messages: number }
  members?: GroupMember[]
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
}

export interface ThreadView {
  parent: Message
  replies: Message[]
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
