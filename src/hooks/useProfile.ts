import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch, apiPatch } from '@/lib/api/client'
import { queryKeys } from '@/lib/query-keys'
import { STALE_TIME } from '@/constants/queryConfig'

interface ProfileData {
  name: string
  email: string
  image: string | null
  bio: string | null
}

export function useProfile() {
  return useQuery<ProfileData>({
    queryKey: queryKeys.profile.all,
    queryFn: () => apiFetch('/api/settings/profile'),
    staleTime: STALE_TIME.MEDIUM,
  })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<ProfileData>) => apiPatch('/api/settings/profile', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.profile.all }),
  })
}
