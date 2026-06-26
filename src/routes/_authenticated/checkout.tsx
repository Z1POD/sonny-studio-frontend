import { createFileRoute } from '@tanstack/react-router'
import { CheckOut } from '@/features/catalog/components/CheckOut'

export const Route = createFileRoute('/_authenticated/checkout')({
  component: RouteComponent,
})

function RouteComponent() {
  return <CheckOut />
}