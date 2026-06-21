import { createFileRoute } from '@tanstack/react-router'
import { WalletPage } from '@/features/wallet/components/WalletPage'

export const Route = createFileRoute('/_authenticated/wallet')({
  component: RouteComponent,
})

function RouteComponent() {
  return <WalletPage />
}