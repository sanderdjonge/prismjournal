// src/hooks/useAnalytics.ts
import { useSuspenseQuery } from '@tanstack/react-query';

interface AnalyticsParams {
    from?: string;
    to?: string;
    account?: string | null;
}

type SymbolRow = { symbol: string; profit: number; winRate: number };
type ExpectancyRow = { trade: number; val: number };
type SessionRow = {
    hour: number;
    count: number;
    wins: number;
    losses: number;
    totalPnl: number;
    winRate: number;
    avgRR: number;
};
export type AnalyticsData = {
    symbolData: SymbolRow[];
    expectancyData: ExpectancyRow[];
    sessionData: SessionRow[];
    profitFactor: number;
    expectancy: number;
    avgRR: number;
    meanDrawdown: number;
};

export function useAnalytics({ from, to, account }: AnalyticsParams = {}) {
    return useSuspenseQuery<AnalyticsData>({
        queryKey: ['analytics', from ?? '', to ?? '', account ?? ''],
        queryFn: () => {
            const params = new URLSearchParams();
            if (from) params.set('from', from);
            if (to) params.set('to', to);
            if (account) params.set('account', account);
            const url = `/api/analytics${params.toString() ? `?${params.toString()}` : ''}`;
            return fetch(url).then(r => {
                if (!r.ok) throw new Error('Failed to fetch analytics');
                return r.json();
            });
        },
        staleTime: 30_000,
        retry: 1,
    });
}
