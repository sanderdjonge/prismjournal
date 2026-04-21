import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch, apiPatch, apiDelete } from '@/lib/api/client'
import { queryKeys } from '@/lib/query-keys'
import { STALE_TIME } from '@/constants/queryConfig'

interface Notification {
  id: string
  type: string
  title: string
  message: string
  read: boolean
  createdAt: string
}

export function useNotifications() {
  return useQuery<{ notifications: Notification[] }>({
    queryKey: queryKeys.notifications.all,
    queryFn: () => apiFetch('/api/notifications'),
    staleTime: STALE_TIME.DEFAULT,
    refetchInterval: 60_000,
  })
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids?: string[]) =>
      ids
        ? apiPatch('/api/notifications', { ids })
        : apiPatch('/api/notifications', { markAll: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.notifications.all }),
  })
}

export function useDeleteNotification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id?: string) =>
      id
        ? apiDelete(`/api/notifications?id=${id}`)
        : apiFetch('/api/notifications', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clearAll: true }),
          }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.notifications.all }),
  })
}
