import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiPost } from '@/lib/api/client'
import { queryKeys } from '@/lib/query-keys'

export interface ShareCardResult {
  cardId: string
  mediaId: string
  imageUrl: string
  expiresAt: string
}

export interface ShareCardOptions {
  tradeId: string
  includeScreenshot: boolean
  showPrismScore: boolean
  isPublic: boolean
  platform: 'discord' | 'twitter' | 'reddit' | 'general'
  comment?: string
}

export function useGenerateShareCard() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (options: ShareCardOptions) =>
      apiPost<ShareCardResult>('/api/share/card', options),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys['share-card'].all })
    },
  })
}
