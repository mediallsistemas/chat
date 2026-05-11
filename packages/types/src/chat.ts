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
}
