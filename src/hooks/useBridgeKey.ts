import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch, apiPost } from '@/lib/api/client'
import { queryKeys } from '@/lib/query-keys'

export interface BridgeKeyInfo {
  bridgeKey: string | null
  hasBridgeKey: boolean
}

export function useBridgeKey() {
  return useQuery<BridgeKeyInfo>({
    queryKey: queryKeys['bridge-key'].all,
    queryFn: () => apiFetch('/api/account/bridge'),
    staleTime: 60_000,
  })
}

export function useRegenerateBridgeKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiPost<BridgeKeyInfo>('/api/account/bridge', {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys['bridge-key'].all }),
  })
}
