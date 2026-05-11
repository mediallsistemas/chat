export interface Unit {
  id: string
  name: string
  type: string
  parentId: string | null
  managerId: string | null
  manager?: { id: string; name: string; email: string } | null
}
