import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch, apiPost } from '@/lib/api/client'
import { queryKeys } from '@/lib/query-keys'
import { STALE_TIME } from '@/constants/queryConfig'
export type { BridgeKeyInfo } from '@/types/auth'
import type { BridgeKeyInfo } from '@/types/auth'

export function useBridgeKey() {
  return useQuery<BridgeKeyInfo>({
    queryKey: queryKeys['bridge-key'].all,
    queryFn: () => apiFetch('/api/account/bridge'),
    staleTime: STALE_TIME.MEDIUM,
  })
}

export function useRegenerateBridgeKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiPost<BridgeKeyInfo>('/api/account/bridge', {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys['bridge-key'].all }),
  })
}
