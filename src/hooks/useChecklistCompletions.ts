import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch, apiPost } from '@/lib/api/client'
import { queryKeys } from '@/lib/query-keys'

interface ChecklistCompletion {
  id: string
  checklistId: string
  tradeId: string
  completedItems: string[]
  completedAt: string
}

export function useChecklistCompletions(tradeId: string | null) {
  return useQuery<ChecklistCompletion[]>({
    queryKey: queryKeys['checklist-completions'].detail(tradeId ?? ''),
    queryFn: () => apiFetch(`/api/checklist-completions?tradeId=${tradeId}`),
    enabled: !!tradeId,
  })
}

export function useSaveChecklistCompletion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { tradeId: string; checklistId: string; completedItems: string[] }) =>
      apiPost('/api/checklist-completions', data),
    onSuccess: (_data, { tradeId }) => {
      qc.invalidateQueries({ queryKey: queryKeys['checklist-completions'].detail(tradeId) })
    },
  })
}
