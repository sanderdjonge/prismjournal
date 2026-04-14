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
      apiPatch('/api/notifications', { ids }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.notifications.all }),
  })
}

export function useDeleteNotification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id?: string) => apiDelete(`/api/notifications${id ? `?id=${id}` : '?all=true'}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.notifications.all }),
  })
}
