export const UNITS_READ_PORT = Symbol('UNITS_READ_PORT')

export interface UnitSnapshot {
  id: string
  name: string
  type: string
  isActive: boolean
  parentId: string | null
}

export interface UnitsReadPort {
  getById(unitId: string): Promise<UnitSnapshot | null>
  listForUser(userId: string): Promise<UnitSnapshot[]>
}
