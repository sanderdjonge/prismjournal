'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch, apiPatch } from '@/lib/api/client'
import { queryKeys } from '@/lib/query-keys'
import { STALE_TIME } from '@/constants/queryConfig'

type UserSettings = {
  displayCurrency: string
  timezone: string
  dateFormat: 'DD-MM-YYYY' | 'MM-DD-YYYY' | 'YYYY-MM-DD'
  brokerTimezoneOffset: number
  dashboardPeriod: '7' | '30' | '90' | '365'
  twoFAEnabled: boolean
  isSuperuser: boolean
}

export function useSettings() {
  const queryClient = useQueryClient()

  const { data, error, isLoading, refetch } = useQuery<UserSettings>({
    queryKey: queryKeys.settings.all,
    queryFn: () => apiFetch<UserSettings>('/api/settings'),
    staleTime: STALE_TIME.MEDIUM,
  })

  const mutation = useMutation({
    mutationFn: (updates: Partial<UserSettings>) =>
      apiPatch<UserSettings>('/api/settings', updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.all })
    },
  })

  return {
    settings: data,
    isLoading,
    isError: !!error,
    error,
    refetch,
    updateSettings: mutation.mutate,
    updateSettingsAsync: mutation.mutateAsync,
    isUpdating: mutation.isPending,
    displayCurrency: data?.displayCurrency ?? 'USD',
    timezone: data?.timezone ?? 'Europe/Amsterdam',
    dateFormat: data?.dateFormat ?? 'DD-MM-YYYY',
    brokerTimezoneOffset: data?.brokerTimezoneOffset ?? 0,
    dashboardPeriod: data?.dashboardPeriod ?? '30',
    twoFAEnabled: data?.twoFAEnabled ?? false,
    isSuperuser: data?.isSuperuser ?? false,
  }
}
