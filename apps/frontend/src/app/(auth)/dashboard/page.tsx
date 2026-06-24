'use client'

import { PageHeader } from '@/shared/components'
import { Button } from '@/shared/components/ui'
import { HoldingDashboard, UnitDashboard } from '@/features/dashboard/components'
import { useDownloadDashboardPdf } from '@/features/reports/hooks/use-reports'
import { useUnitStore } from '@/shared/store/unit-store'

/**
 * Scope-aware dashboard (plano 25): the header scope selector drives what this
 * page shows.
 * - "Toda a holding" (scope 'ALL') → consolidated cross-unit panel.
 * - A single unit selected (scope 'UNIT') → that unit's focused dashboard.
 * SINGLE-scope users (no selector) land in their only unit's view naturally.
 */
export default function DashboardPage() {
  const scope = useUnitStore((s) => s.scope)
  const activeUnit = useUnitStore((s) => s.activeUnit)
  const { download: downloadPdf, isPending: exportingPdf } = useDownloadDashboardPdf()

  if (scope === 'UNIT') {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <PageHeader title={activeUnit ? `Painel — ${activeUnit.name}` : 'Painel da Unidade'} />
        {activeUnit ? (
          <UnitDashboard unitId={activeUnit.id} />
        ) : (
          <div className="py-16 text-center">
            <i className="ti ti-building-community text-4xl text-gs mb-3 block" aria-hidden="true" />
            <p className="text-sm text-gx">Selecione uma unidade no topo para ver o painel.</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Painel da Diretoria" />
        <Button
          variant="secondary"
          size="sm"
          onClick={downloadPdf}
          loading={exportingPdf}
          aria-label="Exportar relatório executivo em PDF"
        >
          <i className="ti ti-file-type-pdf mr-1.5 text-red-500" />
          Exportar PDF
        </Button>
      </div>
      <HoldingDashboard />
    </div>
  )
}
