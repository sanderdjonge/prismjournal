// src/hooks/usePerformance.ts
import { useQuery } from '@tanstack/react-query';

export function usePerformance(period: number) {
    return useQuery({
        queryKey: ['performance', period],
        queryFn: () =>
            fetch(`/api/performance?period=${period}`).then(r => {
                if (!r.ok) throw new Error('Failed to fetch performance');
                return r.json();
            }),
    });
}
