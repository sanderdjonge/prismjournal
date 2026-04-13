import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiPost, apiPatch } from '@/lib/api/client'
import { queryKeys } from '@/lib/query-keys'

export function useUpdateNotificationSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiPatch('/api/settings/notifications', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys['notifications-settings'].all }),
  })
}

export function useTestTelegram() {
  return useMutation({
    mutationFn: () => apiPost('/api/telegram/test', {}),
  })
}

export function useSetup2FA() {
  return useMutation({
    mutationFn: () => apiPost<{ secret: string; qrCodeUrl: string }>('/api/2fa/setup', {}),
  })
}

export function useVerify2FA() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (code: string) => apiPost('/api/2fa/verify', { code }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.settings.all }),
  })
}

export function useDisable2FA() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { password: string; code: string }) =>
      apiPost('/api/2fa/disable', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.settings.all }),
  })
}
