import { createFileRoute } from '@tanstack/react-router'
import { CatalogPage } from '@/features/catalog/components/CatalogPage'

export const Route = createFileRoute('/_authenticated/catalog')({
  component: RouteComponent,
})

function RouteComponent() {
  return <CatalogPage />
}