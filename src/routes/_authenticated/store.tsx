import { createFileRoute } from '@tanstack/react-router'
import { StoreDashboard } from '@/features/store/components/StoreDashboard'

export const Route = createFileRoute('/_authenticated/store')({
  component: RouteComponent,
})

function RouteComponent() {
  return <StoreDashboard />
}