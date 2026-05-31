import Link from 'next/link'
import { PageHeader } from '@/components/shared'

// Boards are owned by phases, macro-tasks or groups — there is no standalone
// board list, so this route guides the user to where boards are accessed
// instead of redirecting to a hardcoded board that may not exist.
export default function KanbanIndexPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader title="Quadros Kanban" />

      <div className="bg-white rounded-2xl border border-gs/60 p-8 text-center">
        <i className="ti ti-layout-kanban text-4xl text-gd" aria-hidden="true" />
        <h2 className="mt-3 text-base font-semibold text-gray-800">
          Os quadros ficam vinculados ao seu contexto
        </h2>
        <p className="mt-1 text-sm text-gx">
          Cada quadro pertence a uma fase de processo, uma macro tarefa ou um grupo de
          comunicação. Acesse o quadro a partir de onde ele vive.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link
            href="/processos"
            className="flex items-center gap-3 rounded-xl border border-gs/60 p-4 text-left hover:border-gd hover:bg-page-bg/50 transition-colors"
          >
            <i className="ti ti-target-arrow text-xl text-gd" aria-hidden="true" />
            <span>
              <span className="block text-sm font-medium text-gray-800">Processos</span>
              <span className="block text-xs text-gx">Quadros das fases e macro tarefas</span>
            </span>
          </Link>

          <Link
            href="/mensagens"
            className="flex items-center gap-3 rounded-xl border border-gs/60 p-4 text-left hover:border-gd hover:bg-page-bg/50 transition-colors"
          >
            <i className="ti ti-messages text-xl text-gd" aria-hidden="true" />
            <span>
              <span className="block text-sm font-medium text-gray-800">Mensagens</span>
              <span className="block text-xs text-gx">Quadros dos grupos de comunicação</span>
            </span>
          </Link>
        </div>
      </div>
    </div>
  )
}
