import dynamic from 'next/dynamic'
import { KanbanBoardSkeleton } from './kanban-board-skeleton'

interface Props {
  boardId: string
  boardName?: string
}

const KanbanBoardClient = dynamic(
  () => import('./kanban-board-client').then((m) => m.KanbanBoardClient),
  { ssr: false, loading: () => <KanbanBoardSkeleton /> },
)

export function KanbanBoard(props: Props) {
  return <KanbanBoardClient {...props} />
}
