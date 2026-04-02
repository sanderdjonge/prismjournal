'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  WhatIfFilters,
  TimeFilters,
  RiskFilters,
  PsychologyFilters,
  MarketFilters,
} from '@/lib/services/what-if/types';

// Re-export types for backward compatibility
export type {
  WhatIfFilters,
  TimeFilters,
  RiskFilters,
  PsychologyFilters,
  MarketFilters,
} from '@/lib/services/what-if/types';

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

/**
 * Build query string from filters
 * Supports both legacy flat filters and new nested filters
 */
function buildQueryString(filters: WhatIfFilters): string {
    const params = new URLSearchParams();
    
    // Legacy flat filters
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
        params.set('startDate', typeof filters.startDate === 'string' ? filters.startDate : filters.startDate.toISOString());
    }
    if (filters.endDate) {
        params.set('endDate', typeof filters.endDate === 'string' ? filters.endDate : filters.endDate.toISOString());
    }
    if (filters.accountIds?.length) {
        params.set('accountIds', filters.accountIds.join(','));
    }
    if (filters.direction) {
        params.set('direction', filters.direction);
    }
    
    // New nested filters - Time
    if (filters.time?.maxDurationHours !== undefined) {
        params.set('maxDurationHours', String(filters.time.maxDurationHours));
    }
    if (filters.time?.minDurationHours !== undefined) {
        params.set('minDurationHours', String(filters.time.minDurationHours));
    }
    if (filters.time?.marketSession?.length) {
        params.set('marketSession', filters.time.marketSession.join(','));
    }
    
    // New nested filters - Risk
    if (filters.risk?.maeMultiplier !== undefined) {
        params.set('maeMultiplier', String(filters.risk.maeMultiplier));
    }
    if (filters.risk?.mfeMultiplier !== undefined) {
        params.set('mfeMultiplier', String(filters.risk.mfeMultiplier));
    }
    if (filters.risk?.breakevenTrigger !== undefined) {
        params.set('breakevenTrigger', String(filters.risk.breakevenTrigger));
    }
    if (filters.risk?.positionSizeMethod) {
        params.set('positionSizeMethod', filters.risk.positionSizeMethod);
    }
    if (filters.risk?.riskPerTrade !== undefined) {
        params.set('riskPerTrade', String(filters.risk.riskPerTrade));
    }
    if (filters.risk?.trailingPercent !== undefined) {
        params.set('trailingPercent', String(filters.risk.trailingPercent));
    }
    if (filters.risk?.partialExitAt) {
        params.set('partialExitAt', JSON.stringify(filters.risk.partialExitAt));
    }
    
    // New nested filters - Psychology
    if (filters.psychology?.dailyLossLimit !== undefined) {
        params.set('dailyLossLimit', String(filters.psychology.dailyLossLimit));
    }
    if (filters.psychology?.weeklyLossLimit !== undefined) {
        params.set('weeklyLossLimit', String(filters.psychology.weeklyLossLimit));
    }
    if (filters.psychology?.stopAfterLosses !== undefined) {
        params.set('stopAfterLosses', String(filters.psychology.stopAfterLosses));
    }
    if (filters.psychology?.avoidAfterBigLoss) {
        params.set('avoidAfterBigLoss', JSON.stringify(filters.psychology.avoidAfterBigLoss));
    }
    
    // New nested filters - Market
    if (filters.market?.minVolatility !== undefined) {
        params.set('minVolatility', String(filters.market.minVolatility));
    }
    if (filters.market?.maxVolatility !== undefined) {
        params.set('maxVolatility', String(filters.market.maxVolatility));
    }
    if (filters.market?.avoidNewsEvents !== undefined) {
        params.set('avoidNewsEvents', String(filters.market.avoidNewsEvents));
    }
    if (filters.market?.newsBufferMinutes !== undefined) {
        params.set('newsBufferMinutes', String(filters.market.newsBufferMinutes));
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