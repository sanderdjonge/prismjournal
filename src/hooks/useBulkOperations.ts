import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface BulkDeleteRequest {
    action: 'delete';
    tradeIds: string[];
}

interface BulkTagRequest {
    action: 'tag';
    tradeIds: string[];
    tagId: string;
}

interface BulkAccountRequest {
    action: 'account';
    tradeIds: string[];
    accountId: string;
}

type BulkRequest = BulkDeleteRequest | BulkTagRequest | BulkAccountRequest;

interface BulkResponse {
    deleted?: number;
    tagged?: number;
    moved?: number;
}

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

export function useBulkOperations() {
    const queryClient = useQueryClient();

    const bulkDelete = useMutation({
        mutationFn: (tradeIds: string[]) => bulkOperation({ action: 'delete', tradeIds }),
        onSuccess: (data) => {
            toast.success(`${data.deleted} trades deleted`);
            queryClient.invalidateQueries({ queryKey: ['trades'] });
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to delete trades');
        },
    });

    const bulkTag = useMutation({
        mutationFn: ({ tradeIds, tagId }: { tradeIds: string[]; tagId: string }) =>
            bulkOperation({ action: 'tag', tradeIds, tagId }),
        onSuccess: (data) => {
            toast.success(`${data.tagged} trades tagged`);
            queryClient.invalidateQueries({ queryKey: ['trades'] });
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to tag trades');
        },
    });

    const bulkAccount = useMutation({
        mutationFn: ({ tradeIds, accountId }: { tradeIds: string[]; accountId: string }) =>
            bulkOperation({ action: 'account', tradeIds, accountId }),
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
