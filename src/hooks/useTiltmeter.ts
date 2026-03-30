// src/hooks/useTiltmeter.ts
import { useQuery } from '@tanstack/react-query';

export interface TiltmeterDataPoint {
    date: string;
    score: number;
    violationCount: number;
}

export interface TiltmeterHistoryResponse {
    snapshots: TiltmeterDataPoint[];
}

export interface TiltmeterScoreResponse {
    score: number;
    components: Record<string, { count: number; weightedScore: number }>;
    totalViolations: number;
    periodStart: string;
    periodEnd: string;
}

export function useTiltmeterHistory(
    accountId?: string | null,
    startDate?: Date,
    endDate?: Date,
    enabled: boolean = true
) {
    return useQuery<TiltmeterHistoryResponse>({
        queryKey: ['tiltmeter-history', accountId, startDate?.toISOString() ?? null, endDate?.toISOString() ?? null],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (accountId) params.set('account', accountId);
            if (startDate) params.set('startDate', startDate.toISOString());
            if (endDate) params.set('endDate', endDate.toISOString());
            params.set('history', 'true');
            
            const response = await fetch(`/api/analytics/tiltmeter?${params.toString()}`);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Failed to fetch tiltmeter history (${response.status})`);
            }
            return response.json();
        },
        staleTime: 60_000, // 1 minute
        enabled,
    });
}

export function useTiltmeterScore(
    accountId?: string | null,
    periodDays: number = 30,
    enabled: boolean = true
) {
    return useQuery<TiltmeterScoreResponse>({
        queryKey: ['tiltmeter-score', accountId, periodDays],
        queryFn: async () => {
            const params = new URLSearchParams({ periodDays: String(periodDays) });
            if (accountId) params.set('account', accountId);
            
            const response = await fetch(`/api/analytics/tiltmeter?${params.toString()}`);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Failed to fetch tiltmeter score (${response.status})`);
            }
            return response.json();
        },
        staleTime: 60_000, // 1 minute
        enabled,
    });
}