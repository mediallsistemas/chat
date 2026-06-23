'use client'

import { DonutChart, BarChart, TrendChart } from '@/shared/components/ui'
import type { DonutSegment, BarChartItem, ChartTone, TrendSeries } from '@/shared/components/ui'
import type { DashboardUnit, DashboardTrends } from '../hooks/use-dashboard'

type Farol = 'GREEN' | 'YELLOW' | 'RED'

const STATUS_TONE: Record<Farol, ChartTone> = { GREEN: 'green', YELLOW: 'yellow', RED: 'red' }
const STATUS_LABEL: Record<Farol, string> = { GREEN: 'No prazo', YELLOW: 'Atenção', RED: 'Atrasado' }

/** ISO date (YYYY-MM-DD) → dd/MM for compact axis labels. */
function shortDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="bg-white rounded-2xl border border-gs/60 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gs/60">
        <h2 className="text-sm font-semibold text-gray-700 font-sora">{title}</h2>
        {subtitle && <span className="text-xs text-gx">{subtitle}</span>}
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  )
}

function ChartState({ loading, error, onRetry }: { loading: boolean; error: boolean; onRetry?: () => void }) {
  if (loading) return <div className="h-40 rounded-xl bg-gs/40 animate-pulse" />
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <i className="ti ti-alert-triangle text-2xl text-gs" aria-hidden="true" />
      <p className="text-xs text-gx">Não foi possível carregar as tendências.</p>
      {onRetry && (
        <button onClick={onRetry} className="text-xs text-gm hover:text-gd font-medium">
          Tentar novamente
        </button>
      )}
    </div>
  )
}

interface DashboardChartsProps {
  units: DashboardUnit[]
  trends: DashboardTrends | undefined
  trendsLoading: boolean
  trendsError: boolean
  onRetryTrends: () => void
}

/**
 * Visual overview of the panel (plano 25 — gráficos). Built on the shared SVG
 * primitives (no chart lib). These reflect the whole scope (not the page list
 * filters): farol distribution + ranked progress (snapshot data), and the
 * burn-up / impediments / plan-progress time-series (from /dashboard/trends).
 */
export function DashboardCharts({ units, trends, trendsLoading, trendsError, onRetryTrends }: DashboardChartsProps) {
  const counts: Record<Farol, number> = { GREEN: 0, YELLOW: 0, RED: 0 }
  for (const u of units) counts[u.status] += 1
  const donutSegments: DonutSegment[] = (['GREEN', 'YELLOW', 'RED'] as Farol[]).map((s) => ({
    label: STATUS_LABEL[s],
    value: counts[s],
    tone: STATUS_TONE[s],
  }))

  const bars: BarChartItem[] = [...units]
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 8)
    .map((u) => ({
      label: u.name,
      value: u.progress,
      tone: STATUS_TONE[u.status],
      hint: `${u.plans} ${u.plans === 1 ? 'plano' : 'planos'}`,
    }))

  const weekLabels = trends?.weeks.map(shortDate) ?? []
  const progressLabels = trends?.planProgress.map((p) => shortDate(p.date)) ?? []

  const completionSeries: TrendSeries[] = [
    { label: 'Concluídas', points: trends?.completion ?? [], tone: 'brand', area: true },
  ]
  const impedimentSeries: TrendSeries[] = [
    { label: 'Abertos', points: trends?.impedimentsOpened ?? [], tone: 'red' },
    { label: 'Resolvidos', points: trends?.impedimentsResolved ?? [], tone: 'green' },
  ]
  const progressSeries: TrendSeries[] = [
    { label: 'Progresso médio', points: trends?.planProgress.map((p) => p.avgProgress) ?? [], tone: 'lime', area: true },
  ]

  const showTrendState = trendsLoading || trendsError

  return (
    <div className="space-y-4">
      {/* Snapshot overview — from /dashboard/summary (always present). */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Saúde das unidades" subtitle={`${units.length} ${units.length === 1 ? 'unidade' : 'unidades'}`}>
          {units.length === 0 ? (
            <p className="text-xs text-gx py-8 text-center">Nenhuma unidade.</p>
          ) : (
            <DonutChart
              segments={donutSegments}
              centerLabel={String(units.length)}
              centerSub={units.length === 1 ? 'unidade' : 'unidades'}
            />
          )}
        </ChartCard>

        <ChartCard title="Progresso por unidade" subtitle="Top 8">
          <BarChart items={bars} max={100} formatValue={(v) => `${v}%`} emptyLabel="Nenhuma unidade com progresso." />
        </ChartCard>
      </div>

      {/* Time-series — from /dashboard/trends. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Evolução do progresso dos planos" subtitle="Progresso médio (%)">
          {showTrendState ? (
            <ChartState loading={trendsLoading} error={trendsError} onRetry={onRetryTrends} />
          ) : (
            <TrendChart
              labels={progressLabels}
              series={progressSeries}
              yMax={100}
              emptyLabel="O histórico será acumulado a partir de hoje."
            />
          )}
        </ChartCard>

        <ChartCard title="Conclusão de tarefas" subtitle="Últimas 12 semanas">
          {showTrendState ? (
            <ChartState loading={trendsLoading} error={trendsError} onRetry={onRetryTrends} />
          ) : (
            <TrendChart labels={weekLabels} series={completionSeries} />
          )}
        </ChartCard>
      </div>

      <ChartCard title="Impedimentos: abertos × resolvidos" subtitle="Últimas 12 semanas">
        {showTrendState ? (
          <ChartState loading={trendsLoading} error={trendsError} onRetry={onRetryTrends} />
        ) : (
          <TrendChart labels={weekLabels} series={impedimentSeries} height={140} />
        )}
      </ChartCard>
    </div>
  )
}
