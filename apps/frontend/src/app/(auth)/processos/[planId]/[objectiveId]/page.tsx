import { ObjectiveDetailView } from './objective-detail-view'

interface Props {
  params: { planId: string; objectiveId: string }
}

export default function ObjectiveDetailPage({ params }: Props) {
  return <ObjectiveDetailView {...params} />
}
