import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch, apiPost, apiPatch, apiDelete } from '@/lib/api/client'
import { queryKeys } from '@/lib/query-keys'

export interface Tag {
  id: string
  name: string
  color?: string | null
  _count?: { trades: number }
}

export function useTags() {
  return useQuery({
    queryKey: queryKeys.tags.all,
    queryFn: () => apiFetch<{ tags: Tag[] }>('/api/tags'),
  })
}

export function useCreateTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { name: string; color?: string }) => apiPost<Tag>('/api/tags', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.tags.all }),
  })
}

export function useUpdateTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: { name?: string; color?: string } }) =>
      apiPatch(`/api/tags/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.tags.all }),
  })
}

export function useDeleteTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/tags/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.tags.all }),
  })
}
