import { useQuery } from '@tanstack/react-query'

export interface Notification {
  id: string
  category: string
  level: 'error' | 'warning' | 'info'
  title: string
  message: string
  ago: string
}

export function useNotifications() {
  return useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await fetch('/api/notifications')
      if (!res.ok) throw new Error('Failed to fetch notifications')
      return res.json()
    },
    staleTime: 60_000,
  })
}