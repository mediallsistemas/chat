export interface DocumentFolder {
  id: string
  name: string
  parentId: string | null
  unitId: string
  createdBy: string
  createdAt: string
  updatedAt: string
  children?: DocumentFolder[]
  documents?: Document[]
  _count?: { documents: number; children: number }
}

export interface Document {
  id: string
  name: string
  description: string | null
  folderId: string | null
  unitId: string
  fileKey: string
  fileName: string
  fileSize: number
  fileMime: string
  uploadedBy: string
  createdAt: string
  updatedAt: string
  signedUrl?: string
  uploader?: { id: string; name: string }
}
