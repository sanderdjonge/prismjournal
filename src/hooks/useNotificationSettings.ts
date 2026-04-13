import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api/client'
import { queryKeys } from '@/lib/query-keys'

export interface NotificationSettings {
  enableSync: boolean
  enableTrades: boolean
  enableRisk: boolean
  telegramId: string | null
  mddThreshold: number | null
  enableWeeklyDigest: boolean
  enableMddAlerts: boolean
  digestFrequency: string
  digestSendHour: number
  inAppToast: boolean
}

export function useNotificationSettings() {
  return useQuery<NotificationSettings>({
    queryKey: queryKeys['notifications-settings'].all,
    queryFn: () => apiFetch('/api/settings/notifications'),
    staleTime: 60_000,
  })
}
