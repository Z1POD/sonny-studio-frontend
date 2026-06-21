import { createFileRoute } from '@tanstack/react-router'
import { StudioWorkspace } from '@/features/studio/components/StudioWorkspace'

export const Route = createFileRoute('/_authenticated/studio')({
  component: RouteComponent,
})

function RouteComponent() {
  return <StudioWorkspace />
}