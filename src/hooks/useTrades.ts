// src/hooks/useTrades.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface TradeFilters {
    q?: string;
    side?: string;
    result?: string;
    from?: string;
    to?: string;
    symbol?: string;
    tag?: string;
    page?: number;
    limit?: number;
}

async function fetchTrades(filters: TradeFilters) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
        if (v !== undefined && v !== '') params.set(k, String(v));
    });
    const res = await fetch(`/api/trades?${params}`);
    if (!res.ok) throw new Error('Failed to fetch trades');
    return res.json();
}

export function useTrades(filters: TradeFilters = {}) {
    return useQuery({
        queryKey: ['trades', filters],
        queryFn: () => fetchTrades(filters),
    });
}

export function useDeleteTrade() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) =>
            fetch(`/api/trades/${id}`, { method: 'DELETE' }).then(r => {
                if (!r.ok) throw new Error('Delete failed');
            }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['trades'] }),
    });
}

export function useCreateTrade() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: Record<string, unknown>) =>
            fetch('/api/trades', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            }).then(async r => {
                if (!r.ok) throw new Error(await r.text());
                return r.json();
            }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['trades'] }),
    });
}

export function useUpdateTrade() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
            fetch(`/api/trades/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            }).then(async r => {
                if (!r.ok) throw new Error(await r.text());
                return r.json();
            }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['trades'] }),
    });
}
