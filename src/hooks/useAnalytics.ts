// src/hooks/useAnalytics.ts
import { useQuery } from '@tanstack/react-query';

interface AnalyticsParams {
    from?: string;
    to?: string;
    account?: string | null;
}

export function useAnalytics({ from, to, account }: AnalyticsParams = {}) {
    return useQuery({
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
