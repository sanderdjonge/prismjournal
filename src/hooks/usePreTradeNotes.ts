// src/hooks/usePreTradeNotes.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface PreTradeNote {
    id: string;
    symbol: string;
    direction: 'LONG' | 'SHORT';
    body: string;
    plannedEntry: number | null;
    status: 'PENDING' | 'LINKED' | 'NOT_RELEVANT' | 'EXPIRED';
    createdAt: string;
    trade?: {
        id: string;
        symbol: string;
        direction: string;
        pnl: number | null;
        entryTime: string;
        exitTime: string | null;
    } | null;
    account?: {
        id: string;
        name: string;
    } | null;
}

interface UsePreTradeNotesParams {
    status?: 'PENDING' | 'LINKED' | 'NOT_RELEVANT' | 'EXPIRED';
    limit?: number;
}

export function usePreTradeNotes({ status, limit = 50 }: UsePreTradeNotesParams = {}) {
    return useQuery<{ notes: PreTradeNote[]; total: number }>({
        queryKey: ['pre-trade-notes', status, limit],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (status) params.set('status', status);
            params.set('limit', String(limit));
            
            const response = await fetch(`/api/pre-trade-notes?${params}`);
            if (!response.ok) throw new Error('Failed to fetch pre-trade notes');
            return response.json();
        },
        staleTime: 30_000,
    });
}

interface CreatePreTradeNoteData {
    symbol: string;
    direction: 'LONG' | 'SHORT';
    body: string;
    plannedEntry?: number;
    accountId?: string;
}

export function useCreatePreTradeNote() {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: async (data: CreatePreTradeNoteData) => {
            const response = await fetch('/api/pre-trade-notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create note');
            }
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pre-trade-notes'] });
        },
    });
}

interface UpdatePreTradeNoteData {
    id: string;
    body?: string;
    plannedEntry?: number;
    status?: 'PENDING' | 'LINKED' | 'NOT_RELEVANT' | 'EXPIRED';
    tradeId?: string;
}

export function useUpdatePreTradeNote() {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: async (data: UpdatePreTradeNoteData) => {
            const response = await fetch('/api/pre-trade-notes', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to update note');
            }
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pre-trade-notes'] });
        },
    });
}