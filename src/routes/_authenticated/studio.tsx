import { createFileRoute } from '@tanstack/react-router'
import { StudioPage } from '@/features/studio/components/StudioPage'

export const Route = createFileRoute('/_authenticated/studio')({
  // blank: slug of the blank product · design: one of the creator's saved designs to edit
  // color: preferred garment hex · view=3d: open straight in preview (orbit) mode
  validateSearch: (s: Record<string, unknown>): { blank?: string; design?: string; from?: string; color?: string; view?: '3d' } => ({
    ...(typeof s.blank === 'string' ? { blank: s.blank } : {}),
    ...(typeof s.design === 'string' ? { design: s.design } : {}),
    ...(typeof s.from === 'string' ? { from: s.from } : {}),
    ...(typeof s.color === 'string' ? { color: s.color } : {}),
    ...(s.view === '3d' ? { view: '3d' as const } : {}),
  }),
  component: RouteComponent,
})

function RouteComponent() {
  return <StudioPage />
}
