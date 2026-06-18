import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Unit } from '@mediall/types'

/**
 * Navigation scope (plano 25 — Jarvis):
 * - 'ALL'  → "Toda a holding": aggregated views (dashboard) span every unit; `activeUnit` is null.
 * - 'UNIT' → a single unit is active; mono-unit screens use `activeUnit.id`.
 */
export type UnitScope = 'ALL' | 'UNIT'

interface UnitStore {
  activeUnit: Unit | null
  units: Unit[]
  scope: UnitScope
  /** Select a unit (implicitly switches scope to 'UNIT'). Passing null clears the active unit. */
  setActiveUnit: (unit: Unit | null) => void
  /** Switch to the aggregated "toda a holding" scope (clears `activeUnit`). */
  enterHoldingScope: () => void
  setUnits: (units: Unit[]) => void
}

export const useUnitStore = create<UnitStore>()(
  persist(
    (set) => ({
      activeUnit: null,
      units: [],
      scope: 'UNIT',
      setActiveUnit: (unit) => set({ activeUnit: unit, scope: unit ? 'UNIT' : 'ALL' }),
      enterHoldingScope: () => set({ activeUnit: null, scope: 'ALL' }),
      setUnits: (units) => set({ units }),
    }),
    { name: 'mediall-unit' },
  ),
)
