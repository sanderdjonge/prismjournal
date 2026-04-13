import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch, apiPost, apiPatch, apiDelete } from '@/lib/api/client'
import { queryKeys } from '@/lib/query-keys'

export interface ChecklistItemData {
  id: string
  label: string
  required: boolean
  order: number
}

export interface ChecklistData {
  id: string
  name: string
  items: ChecklistItemData[]
  _count?: { strategies: number }
}

export function useChecklists() {
  return useQuery({
    queryKey: queryKeys.checklists.all,
    queryFn: () => apiFetch<{ checklists: ChecklistData[] }>('/api/checklists'),
  })
}

export function useCreateChecklist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; items: Omit<ChecklistItemData, 'id'>[] }) =>
      apiPost('/api/checklists', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.checklists.all }),
  })
}

export function useUpdateChecklist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; items?: Omit<ChecklistItemData, 'id'>[] }) =>
      apiPatch(`/api/checklists/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.checklists.all }),
  })
}

export function useDeleteChecklist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/checklists/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.checklists.all })
      qc.invalidateQueries({ queryKey: queryKeys.strategies.all })
    },
  })
}
