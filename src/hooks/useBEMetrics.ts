import { useQuery } from '@tanstack/react-query';
import { STALE_TIME } from '@/constants/queryConfig';

export interface BEMetrics {
    beProtectionRate: number;   // 0–1 fraction of trades where BE was triggered
    beStopOutRate: number;      // 0–1 fraction of BE trades that closed at a loss
    avgRCaptured: number;       // average rMultiple across all trades
    avgRPotential: number;      // avg (TP dist / initialSL dist) where available
    rEfficiency: number;        // avgRCaptured / avgRPotential (0–1)
    tradeCount: number;
}

export function useBEMetrics(accountId?: string | null) {
    return useQuery<BEMetrics>({
        queryKey: ['be-metrics', accountId ?? 'all'],
        queryFn: () => {
            const params = new URLSearchParams();
            if (accountId) params.set('accountId', accountId);
            const url = `/api/analytics/be-metrics${params.toString() ? `?${params.toString()}` : ''}`;
            return fetch(url).then(r => {
                if (!r.ok) throw new Error('Failed to fetch BE metrics');
                return r.json();
            });
        },
        staleTime: STALE_TIME.DEFAULT,
    });
}
