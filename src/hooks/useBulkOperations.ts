import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiPost } from '@/lib/api/client'
import { queryKeys } from '@/lib/query-keys'

interface BulkDeleteRequest { action: 'delete'; tradeIds: string[] }
interface BulkTagRequest { action: 'tag'; tradeIds: string[]; tagId: string }
interface BulkAccountRequest { action: 'account'; tradeIds: string[]; accountId: string }
interface BulkStrategyRequest { action: 'setStrategy'; tradeIds: string[]; strategyId: string | null }
type BulkRequest = BulkDeleteRequest | BulkTagRequest | BulkAccountRequest | BulkStrategyRequest
interface BulkResponse { deleted?: number; tagged?: number; moved?: number; updated?: number }

async function bulkOperation(request: BulkRequest): Promise<BulkResponse> {
  return apiPost('/api/trades/bulk', request)
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size))
  return chunks
}

export function useBulkOperations() {
  const queryClient = useQueryClient()

  const bulkDelete = useMutation({
    mutationFn: async (tradeIds: string[]) => {
      const chunks = chunkArray(tradeIds, 100)
      let total = 0
      for (const chunk of chunks) {
        const r = await bulkOperation({ action: 'delete', tradeIds: chunk })
        total += r.deleted ?? 0
      }
      return { deleted: total }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.trades.all })
    },
  })

  const bulkTag = useMutation({
    mutationFn: async ({ tradeIds, tagId }: { tradeIds: string[]; tagId: string }) => {
      const chunks = chunkArray(tradeIds, 100)
      let total = 0
      for (const chunk of chunks) {
        const r = await bulkOperation({ action: 'tag', tradeIds: chunk, tagId })
        total += r.tagged ?? 0
      }
      return { tagged: total }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.trades.all }),
  })

  const bulkAccount = useMutation({
    mutationFn: async ({ tradeIds, accountId }: { tradeIds: string[]; accountId: string }) => {
      const chunks = chunkArray(tradeIds, 100)
      let total = 0
      for (const chunk of chunks) {
        const r = await bulkOperation({ action: 'account', tradeIds: chunk, accountId })
        total += r.moved ?? 0
      }
      return { moved: total }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.trades.all }),
  })

  const bulkStrategy = useMutation({
    mutationFn: async ({ tradeIds, strategyId }: { tradeIds: string[]; strategyId: string | null }) => {
      const chunks = chunkArray(tradeIds, 100)
      let total = 0
      for (const chunk of chunks) {
        const r = await bulkOperation({ action: 'setStrategy', tradeIds: chunk, strategyId })
        total += r.updated ?? 0
      }
      return { updated: total }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.trades.all }),
  })

  return {
    bulkDelete: bulkDelete.mutateAsync,
    bulkTag: bulkTag.mutateAsync,
    bulkAccount: bulkAccount.mutateAsync,
    bulkStrategy: bulkStrategy.mutateAsync,
    isDeleting: bulkDelete.isPending,
    isTagging: bulkTag.isPending,
    isSettingStrategy: bulkStrategy.isPending,
  }
}
