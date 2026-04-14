import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { apiFetch, apiPost, apiPatch, apiDelete } from '@/lib/api/client'
import { queryKeys } from '@/lib/query-keys'
import { STALE_TIME } from '@/constants/queryConfig'

export interface TradeFilters {
  q?: string
  side?: string
  result?: string
  from?: string
  to?: string
  symbol?: string
  tag?: string
  account?: string
  page?: number
  limit?: number
  closeReason?: string
  strategyId?: string
}

interface TradesResponse {
  trades: unknown[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

async function fetchTrades(filters: TradeFilters) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v))
  })
  return apiFetch<TradesResponse>(`/api/trades?${params}`)
}

export function useTrades(filters: TradeFilters = {}) {
  return useQuery<TradesResponse>({
    queryKey: queryKeys.trades.list(filters),
    queryFn: () => fetchTrades(filters),
    placeholderData: keepPreviousData,
    staleTime: STALE_TIME.DEFAULT,
  })
}

export function useDeleteTrade() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/trades/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.trades.all }),
  })
}

export function useCreateTrade() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => apiPost('/api/trades', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.trades.all }),
  })
}

export function useUpdateTrade() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      apiPatch(`/api/trades/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.trades.all }),
  })
}
