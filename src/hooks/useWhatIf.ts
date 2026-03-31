'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface WhatIfFilters {
    excludeDays?: number[];
    excludeHours?: number[];
    minRR?: number;
    maxRR?: number;
    minProfit?: number;
    maxProfit?: number;
    symbols?: string[];
    stopLossMultiplier?: number;
    startDate?: string;
    endDate?: string;
    accountIds?: string[];
    direction?: 'LONG' | 'SHORT';
}

export interface EquityPoint {
    date: string;
    value: number;
    actualValue: number;
    simulatedValue: number;
}

export interface SimulationResult {
    totalTrades: number;
    totalPnl: number;
    winRate: number;
    profitFactor: number;
    avgRR: number;
    avgWin: number;
    avgLoss: number;
    maxDrawdown: number;
    equityCurve: EquityPoint[];
}

export interface WhatIfResult {
    actual: SimulationResult;
    simulated: SimulationResult;
    difference: {
        tradesRemoved: number;
        pnlDifference: number;
        winRateDifference: number;
        profitFactorDifference: number;
        improvement: boolean;
    };
    filters: WhatIfFilters;
}

function buildQueryString(filters: WhatIfFilters): string {
    const params = new URLSearchParams();
    
    if (filters.excludeDays?.length) {
        params.set('excludeDays', filters.excludeDays.join(','));
    }
    if (filters.excludeHours?.length) {
        params.set('excludeHours', filters.excludeHours.join(','));
    }
    if (filters.minRR !== undefined) {
        params.set('minRR', String(filters.minRR));
    }
    if (filters.maxRR !== undefined) {
        params.set('maxRR', String(filters.maxRR));
    }
    if (filters.minProfit !== undefined) {
        params.set('minProfit', String(filters.minProfit));
    }
    if (filters.maxProfit !== undefined) {
        params.set('maxProfit', String(filters.maxProfit));
    }
    if (filters.symbols?.length) {
        params.set('symbols', filters.symbols.join(','));
    }
    if (filters.stopLossMultiplier !== undefined) {
        params.set('stopLossMultiplier', String(filters.stopLossMultiplier));
    }
    if (filters.startDate) {
        params.set('startDate', filters.startDate);
    }
    if (filters.endDate) {
        params.set('endDate', filters.endDate);
    }
    if (filters.accountIds?.length) {
        params.set('accountIds', filters.accountIds.join(','));
    }
    if (filters.direction) {
        params.set('direction', filters.direction);
    }
    
    return params.toString();
}

export function useWhatIf(filters: WhatIfFilters | null) {
    return useQuery({
        queryKey: ['what-if', filters],
        queryFn: async () => {
            if (!filters || Object.keys(filters).length === 0) return null;
            
            const queryString = buildQueryString(filters);
            const res = await fetch(`/api/analytics/what-if?${queryString}`);
            
            if (!res.ok) throw new Error('Failed to run what-if simulation');
            return res.json() as Promise<WhatIfResult>;
        },
        enabled: !!filters && Object.keys(filters).length > 0,
    });
}

export function useWhatIfMulti() {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: async (scenarios: WhatIfFilters[]) => {
            const res = await fetch('/api/analytics/what-if', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scenarios }),
            });
            
            if (!res.ok) throw new Error('Failed to run multi-scenario simulation');
            return res.json() as Promise<WhatIfResult[]>;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['what-if'] });
        },
    });
}