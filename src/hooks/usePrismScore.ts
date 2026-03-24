import { useQuery } from '@tanstack/react-query';

export interface PrismScoreComponents {
    profitFactor: number;
    winLossRatio: number;
    maxDrawdown: number;
    winRate: number;
    recoveryFactor: number;
    consistency: number;
}

export interface WeeklyScorePoint {
    week: string;
    score: number;
}

export interface PrismScoreData {
    score: number;
    components: PrismScoreComponents;
    weeklyHistory: WeeklyScorePoint[];
}

export function usePrismScore(accountId: string | null) {
    return useQuery<PrismScoreData>({
        queryKey: ['prism-score', accountId],
        queryFn: () => {
            const params = new URLSearchParams();
            if (accountId) params.set('accountId', accountId);
            return fetch(`/api/analytics/prism-score?${params.toString()}`).then(r => {
                if (!r.ok) throw new Error('Failed to fetch Prism Score');
                return r.json();
            });
        },
        staleTime: 60_000,
        retry: 1,
    });
}
