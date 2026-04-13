import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch, apiPatch } from '@/lib/api/client'
import { queryKeys } from '@/lib/query-keys'

interface StrategyRule {
  id?: string
  type: string
  condition: string
  value: string | number
  enabled: boolean
}

export function useStrategyRules(strategyId: string | null) {
  return useQuery<{ rules: StrategyRule[] }>({
    queryKey: queryKeys['strategy-rules'].detail(strategyId ?? ''),
    queryFn: () => apiFetch(`/api/strategies/${strategyId}/rules`),
    enabled: !!strategyId,
  })
}

export function useUpdateStrategyRules() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ strategyId, rules }: { strategyId: string; rules: StrategyRule[] }) =>
      apiPatch(`/api/strategies/${strategyId}/rules`, { rules }),
    onSuccess: (_data, { strategyId }) => {
      qc.invalidateQueries({ queryKey: queryKeys['strategy-rules'].detail(strategyId) })
      qc.invalidateQueries({ queryKey: queryKeys.strategies.all })
    },
  })
}

export function useUpdateStrategyChecklist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ strategyId, checklist }: { strategyId: string; checklist: unknown }) =>
      apiPatch(`/api/strategies/${strategyId}/checklist`, checklist),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.strategies.all })
      qc.invalidateQueries({ queryKey: queryKeys.checklists.all })
    },
  })
}
