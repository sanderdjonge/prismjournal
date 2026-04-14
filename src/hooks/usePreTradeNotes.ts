import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch, apiPost, apiPatch } from '@/lib/api/client'
import { queryKeys } from '@/lib/query-keys'
import { STALE_TIME } from '@/constants/queryConfig'

interface PreTradeNote {
  id: string
  symbol: string
  direction: 'LONG' | 'SHORT'
  body: string
  plannedEntry: number | null
  status: 'PENDING' | 'LINKED' | 'NOT_RELEVANT' | 'EXPIRED'
  createdAt: string
  trade?: {
    id: string
    symbol: string
    direction: string
    pnl: number | null
    entryTime: string
    exitTime: string | null
  } | null
  account?: {
    id: string
    name: string
  } | null
}

interface UsePreTradeNotesParams {
  status?: 'PENDING' | 'LINKED' | 'NOT_RELEVANT' | 'EXPIRED'
  limit?: number
}

export function usePreTradeNotes({ status, limit = 50 }: UsePreTradeNotesParams = {}) {
  return useQuery<{ notes: PreTradeNote[]; total: number }>({
    queryKey: queryKeys['pre-trade-notes'].list(status, limit),
    queryFn: () => {
      const params = new URLSearchParams()
      if (status) params.set('status', status)
      params.set('limit', String(limit))
      return apiFetch(`/api/pre-trade-notes?${params}`)
    },
    staleTime: STALE_TIME.DEFAULT,
  })
}

interface CreatePreTradeNoteData {
  symbol: string
  direction: 'LONG' | 'SHORT'
  body: string
  plannedEntry?: number
  accountId?: string
}

export function useCreatePreTradeNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreatePreTradeNoteData) => apiPost('/api/pre-trade-notes', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys['pre-trade-notes'].all }),
  })
}

interface UpdatePreTradeNoteData {
  id: string
  body?: string
  plannedEntry?: number
  status?: 'PENDING' | 'LINKED' | 'NOT_RELEVANT' | 'EXPIRED'
  tradeId?: string
}

export function useUpdatePreTradeNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdatePreTradeNoteData) => apiPatch('/api/pre-trade-notes', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys['pre-trade-notes'].all }),
  })
}
