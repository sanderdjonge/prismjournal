import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch, apiPost, apiPatch, apiDelete } from '@/lib/api/client'
import { queryKeys } from '@/lib/query-keys'

export interface Strategy {
  id: string
  name: string
  description?: string | null
  checklistId?: string | null
  _count?: { trades: number }
}

export function useStrategies() {
  return useQuery({
    queryKey: queryKeys.strategies.all,
    queryFn: () => apiFetch<{ strategies: Strategy[] }>('/api/strategies'),
  })
}

export function useCreateStrategy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { name: string; description?: string }) =>
      apiPost<Strategy>('/api/strategies', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.strategies.all }),
  })
}

export function useUpdateStrategy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<Strategy> }) =>
      apiPatch<Strategy>(`/api/strategies/${id}`, body),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.strategies.all })
      qc.invalidateQueries({ queryKey: queryKeys.strategies.detail(id) })
    },
  })
}

export function useDeleteStrategy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/strategies/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.strategies.all }),
  })
}
