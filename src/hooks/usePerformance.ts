// src/hooks/usePerformance.ts
import { useSuspenseQuery } from '@tanstack/react-query';
import { STALE_TIME } from '@/constants/queryConfig';
import type { EquityPoint } from '@/types/trade'

interface PerformanceParams {
    period: string;
    accountId?: string | null;
}

type MonthlyReturn = { month: number; value: number };
export type PerfData = {
    equity: EquityPoint[];
    totalPnl: number;
    maxDrawdown: number;
    sharpe: number | null;
    profitFactor: number;
    avgWin: number;
    avgLoss: number;
    expectancy: number;
    monthlyReturns: MonthlyReturn[];
    accountCount?: number;
};

export function usePerformance({ period, accountId }: PerformanceParams) {
    return useSuspenseQuery<PerfData>({
        queryKey: ['performance', period, accountId ?? ''],
        queryFn: () => {
            const params = new URLSearchParams({ period });
            if (accountId) params.set('accountId', accountId);
            return fetch(`/api/performance?${params.toString()}`).then(r => {
                if (!r.ok) throw new Error('Failed to fetch performance');
                return r.json();
            });
        },
        staleTime: STALE_TIME.DEFAULT,
    });
}
