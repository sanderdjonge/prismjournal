// src/hooks/usePerformance.ts
import { useQuery } from '@tanstack/react-query';

interface PerformanceParams {
    period: string;
    accountId?: string | null;
}

export function usePerformance({ period, accountId }: PerformanceParams) {
    return useQuery({
        queryKey: ['performance', period, accountId ?? ''],
        queryFn: () => {
            const params = new URLSearchParams({ period });
            if (accountId) params.set('accountId', accountId);
            return fetch(`/api/performance?${params.toString()}`).then(r => {
                if (!r.ok) throw new Error('Failed to fetch performance');
                return r.json();
            });
        },
        staleTime: 30_000,
        retry: 1,
    });
}
