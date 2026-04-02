/**
 * useRDistribution Hook
 *
 * Fetches R-multiple distribution for histogram chart.
 */

import { useQuery } from '@tanstack/react-query';

export interface RDistributionBucket {
    minR: number;
    maxR: number;
    label: string;
    count: number;
    pct: number;
}

export interface RDistributionStats {
    mean: number;
    median: number;
    stdDev: number;
    min: number;
    max: number;
    positiveCount: number;
    negativeCount: number;
    zeroCount: number;
}

export interface RDistributionResult {
    buckets: RDistributionBucket[];
    stats: RDistributionStats;
}

async function fetchRDistribution(accountId: string | null): Promise<RDistributionResult> {
    const params = new URLSearchParams();
    if (accountId) params.append('accountId', accountId);

    const res = await fetch(`/api/analytics/r-distribution?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch R-distribution');
    return res.json();
}

export function useRDistribution(accountId: string | null) {
    return useQuery({
        queryKey: ['rDistribution', accountId],
        queryFn: () => fetchRDistribution(accountId),
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}