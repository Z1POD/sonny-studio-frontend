import { createFileRoute } from '@tanstack/react-router'
import { OrdersPage } from '@/features/orders/components/OrdersPage'

export const Route = createFileRoute('/_authenticated/orders')({
  // ?order=<id> opens that order's detail sheet (used by notifications and the profile page)
  validateSearch: (s: Record<string, unknown>): { order?: string } => ({
    ...(typeof s.order === 'string' ? { order: s.order } : {}),
  }),
  component: RouteComponent,
})

function RouteComponent() {
  return <OrdersPage />
}
