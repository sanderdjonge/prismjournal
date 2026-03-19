import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface BulkDeleteRequest { action: 'delete'; tradeIds: string[]; }
interface BulkTagRequest { action: 'tag'; tradeIds: string[]; tagId: string; }
interface BulkAccountRequest { action: 'account'; tradeIds: string[]; accountId: string; }
type BulkRequest = BulkDeleteRequest | BulkTagRequest | BulkAccountRequest;
interface BulkResponse { deleted?: number; tagged?: number; moved?: number; }

async function bulkOperation(request: BulkRequest): Promise<BulkResponse> {
    const res = await fetch('/api/trades/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
    });
    if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Operation failed' }));
        throw new Error(error.error || 'Operation failed');
    }
    return res.json();
}

function chunkArray<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
    return chunks;
}

export function useBulkOperations() {
    const queryClient = useQueryClient();

    const bulkDelete = useMutation({
        mutationFn: async (tradeIds: string[]) => {
            const chunks = chunkArray(tradeIds, 100);
            let total = 0;
            for (const chunk of chunks) {
                const r = await bulkOperation({ action: 'delete', tradeIds: chunk });
                total += r.deleted ?? 0;
            }
            return { deleted: total };
        },
        onSuccess: (data) => {
            toast.success(`${data.deleted} trades deleted`);
            queryClient.invalidateQueries({ queryKey: ['trades'] });
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to delete trades');
        },
    });

    const bulkTag = useMutation({
        mutationFn: async ({ tradeIds, tagId }: { tradeIds: string[]; tagId: string }) => {
            const chunks = chunkArray(tradeIds, 100);
            let total = 0;
            for (const chunk of chunks) {
                const r = await bulkOperation({ action: 'tag', tradeIds: chunk, tagId });
                total += r.tagged ?? 0;
            }
            return { tagged: total };
        },
        onSuccess: (data) => {
            toast.success(`${data.tagged} trades tagged`);
            queryClient.invalidateQueries({ queryKey: ['trades'] });
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to tag trades');
        },
    });

    const bulkAccount = useMutation({
        mutationFn: async ({ tradeIds, accountId }: { tradeIds: string[]; accountId: string }) => {
            const chunks = chunkArray(tradeIds, 100);
            let total = 0;
            for (const chunk of chunks) {
                const r = await bulkOperation({ action: 'account', tradeIds: chunk, accountId });
                total += r.moved ?? 0;
            }
            return { moved: total };
        },
        onSuccess: (data) => {
            toast.success(`${data.moved} trades moved`);
            queryClient.invalidateQueries({ queryKey: ['trades'] });
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to move trades');
        },
    });

    return {
        bulkDelete: bulkDelete.mutateAsync,
        bulkTag: bulkTag.mutateAsync,
        bulkAccount: bulkAccount.mutateAsync,
        isDeleting: bulkDelete.isPending,
        isTagging: bulkTag.isPending,
    };
}
