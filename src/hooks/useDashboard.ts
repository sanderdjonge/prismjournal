// src/hooks/useDashboard.ts
import { useSuspenseQuery } from '@tanstack/react-query';

export function useDashboard(period: string, accountId: string | null) {
    return useSuspenseQuery({
        queryKey: ['dashboard', period, accountId],
        queryFn: () => {
            const params = new URLSearchParams({ period });
            if (accountId) params.set('account', accountId);
            return fetch(`/api/dashboard?${params.toString()}`).then(r => {
                if (!r.ok) throw new Error('Failed to fetch dashboard');
                return r.json();
            });
        },
        staleTime: 30_000,
    });
}
