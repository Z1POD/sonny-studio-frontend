import { createFileRoute } from '@tanstack/react-router'
import { AnalyticsPage } from '@/features/analytics/components/AnalyticsPage'

export const Route = createFileRoute('/_authenticated/analytics')({
  component: RouteComponent,
})

function RouteComponent() {
  return <AnalyticsPage />
}