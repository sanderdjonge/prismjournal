// src/hooks/useAnalytics.ts
import { useQuery } from '@tanstack/react-query';

export function useAnalytics() {
    return useQuery({
        queryKey: ['analytics'],
        queryFn: () =>
            fetch('/api/analytics').then(r => {
                if (!r.ok) throw new Error('Failed to fetch analytics');
                return r.json();
            }),
        staleTime: 60_000,
    });
}
