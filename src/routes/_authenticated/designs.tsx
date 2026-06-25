import { createFileRoute } from '@tanstack/react-router'
import { UserDesignsPage } from '@/features/designs/components/UserDesignsPage'
export const Route = createFileRoute('/_authenticated/designs')({
  component: RouteComponent,
})

function RouteComponent() {
  return <UserDesignsPage />
}