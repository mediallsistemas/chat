import { redirect } from 'next/navigation'

// Redirect /kanban to a default demo board
export default function KanbanIndexPage() {
  redirect('/kanban/board-demo')
}
