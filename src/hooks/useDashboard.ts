// src/hooks/useDashboard.ts
import { useQuery } from '@tanstack/react-query';

export function useDashboard() {
    return useQuery({
        queryKey: ['dashboard'],
        queryFn: () =>
            fetch('/api/dashboard').then(r => {
                if (!r.ok) throw new Error('Failed to fetch dashboard');
                return r.json();
            }),
        staleTime: 30_000,
    });
}
