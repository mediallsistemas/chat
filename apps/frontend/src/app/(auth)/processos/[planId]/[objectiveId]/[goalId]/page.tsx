import { GoalDetailView } from './goal-detail-view'

interface Props {
  params: { planId: string; objectiveId: string; goalId: string }
}

export default function GoalDetailPage({ params }: Props) {
  return <GoalDetailView {...params} />
}
