import { createFileRoute } from '@tanstack/react-router'
import { ProfilePage } from '@/features/account/components/ProfilePage'

export const Route = createFileRoute('/_authenticated/profile')({
  head: () => ({ meta: [{ title: 'Profile — M I M O' }] }),
  component: ProfilePage,
})
