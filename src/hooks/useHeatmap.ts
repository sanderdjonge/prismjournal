import { useQuery } from '@tanstack/react-query';
import type { HeatmapCell } from '@/app/api/analytics/heatmap/route';

interface HeatmapFilters {
    accountId?: string;
    from?: string;
    to?: string;
}

async function fetchHeatmap(filters: HeatmapFilters = {}) {
    const params = new URLSearchParams();
    if (filters.accountId) params.set('accountId', filters.accountId);
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);

    const res = await fetch(`/api/analytics/heatmap?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch heatmap');
    return res.json() as Promise<{ cells: HeatmapCell[] }>;
}

export function useHeatmap(filters: HeatmapFilters = {}) {
    return useQuery({
        queryKey: ['heatmap', filters],
        queryFn: () => fetchHeatmap(filters),
        staleTime: 5 * 60 * 1000,
    });
}
