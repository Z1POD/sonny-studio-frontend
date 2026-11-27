import { createFileRoute } from '@tanstack/react-router'
import { UserDesignsPage } from '@/features/designs/components/UserDesignsPage'

export const Route = createFileRoute('/_authenticated/designs')({
  // review: id of a draft to open in Publish & Review (set by the studio after a save)
  validateSearch: (s: Record<string, unknown>): { review?: string } => ({
    ...(typeof s.review === 'string' ? { review: s.review } : {}),
  }),
  component: RouteComponent,
})

function RouteComponent() {
  return <UserDesignsPage />
}
