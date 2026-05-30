import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Unit } from '@mediall/types'

interface UnitStore {
  activeUnit: Unit | null
  units: Unit[]
  setActiveUnit: (unit: Unit | null) => void
  setUnits: (units: Unit[]) => void
}

export const useUnitStore = create<UnitStore>()(
  persist(
    (set) => ({
      activeUnit: null,
      units: [],
      setActiveUnit: (unit) => set({ activeUnit: unit }),
      setUnits: (units) => set({ units }),
    }),
    { name: 'mediall-unit' },
  ),
)
