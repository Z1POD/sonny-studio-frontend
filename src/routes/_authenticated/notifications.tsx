import { createFileRoute } from '@tanstack/react-router'
import { NotificationsPage } from '@/features/account/components/NotificationsPage'

export const Route = createFileRoute('/_authenticated/notifications')({
  head: () => ({ meta: [{ title: 'Notifications — M I M O' }] }),
  component: NotificationsPage,
})
