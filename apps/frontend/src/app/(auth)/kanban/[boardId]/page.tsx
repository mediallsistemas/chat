import { KanbanBoard } from '@/features/kanban/components'

interface Props {
  params: { boardId: string }
}

export default function KanbanBoardPage({ params }: Props) {
  return <KanbanBoard boardId={params.boardId} />
}
