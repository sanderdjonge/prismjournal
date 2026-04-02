/**
 * useSymbolAnalytics Hook
 *
 * Fetches per-symbol analytics for the analytics page.
 */

import { useQuery } from '@tanstack/react-query';

export interface SymbolMetrics {
    symbol: string;
    tradeCount: number;
    winCount: number;
    lossCount: number;
    winRate: number;
    totalPnl: number;
    avgPnl: number;
    avgRR: number;
    bestTrade: number;
    worstTrade: number;
    totalVolume: number;
    avgVolume: number;
    longCount: number;
    shortCount: number;
}

async function fetchSymbolAnalytics(accountId: string | null): Promise<SymbolMetrics[]> {
    const params = new URLSearchParams();
    if (accountId) params.append('accountId', accountId);

    const res = await fetch(`/api/analytics/symbols?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch symbol analytics');
    return res.json();
}

export function useSymbolAnalytics(accountId: string | null) {
    return useQuery({
        queryKey: ['symbolAnalytics', accountId],
        queryFn: () => fetchSymbolAnalytics(accountId),
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}