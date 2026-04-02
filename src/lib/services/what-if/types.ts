/**
 * What-If Filter Type Definitions
 * Phases 27-29
 */

/** Time-based filters */
export interface TimeFilters {
  // Existing (deprecated, backward compatible)
  excludeDays?: number[];
  excludeHours?: number[];
  
  // Phase 27
  maxDurationHours?: number;
  minDurationHours?: number;
  
  // Phase 29
  marketSession?: ('LONDON' | 'NEW_YORK' | 'ASIA' | 'OVERLAP_LN' | 'OVERLAP_NA')[];
}

/** Risk management filters */
export interface RiskFilters {
  // Existing
  stopLossMultiplier?: number;
  
  // Phase 28
  maeMultiplier?: number;
  mfeMultiplier?: number;
  breakevenTrigger?: number;
  positionSizeMethod?: 'FIXED_R' | 'FIXED_DOLLAR' | 'ADAPTIVE';
  riskPerTrade?: number;
  
  // Phase 29
  trailingPercent?: number;
  partialExitAt?: { rLevel: number; percent: number };  // Fixed: was percentClose, matches risk-filters.ts
}

/** Psychology-based filters */
export interface PsychologyFilters {
  // Phase 27
  dailyLossLimit?: number;
  weeklyLossLimit?: number;
  stopAfterLosses?: number;
  
  // Phase 28
  avoidAfterBigLoss?: { rThreshold: number; cooldownHours: number };
}

/** Market context filters */
export interface MarketFilters {
  // Phase 29
  minVolatility?: number;
  maxVolatility?: number;
  avoidNewsEvents?: boolean;
  newsBufferMinutes?: number;
}

/** Unified What-If filters */
export interface WhatIfFilters {
  // Existing (flat)
  minRR?: number;
  maxRR?: number;
  minProfit?: number;
  maxProfit?: number;
  symbols?: string[];
  direction?: 'LONG' | 'SHORT';
  startDate?: Date;
  endDate?: Date;
  accountIds?: string[];
  
  // Legacy flat filters (deprecated, mapped to nested)
  excludeDays?: number[];
  excludeHours?: number[];
  stopLossMultiplier?: number;
  
  // New grouped filters
  time?: TimeFilters;
  risk?: RiskFilters;
  psychology?: PsychologyFilters;
  market?: MarketFilters;
}

/** Normalize legacy flat filters to nested structure */
export function normalizeFilters(filters: Partial<WhatIfFilters>): WhatIfFilters {
  return {
    ...filters,
    time: {
      ...filters.time,
      excludeDays: filters.time?.excludeDays ?? filters.excludeDays,
      excludeHours: filters.time?.excludeHours ?? filters.excludeHours,
    },
    risk: {
      ...filters.risk,
      stopLossMultiplier: filters.risk?.stopLossMultiplier ?? filters.stopLossMultiplier,
    },
  } as WhatIfFilters;
}

/** Trade data structure for What-If simulation */
export interface TradeData {
  id: string;
  symbol: string;
  direction: string;
  entryPrice: number;
  exitPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  pnl: number | null;
  rMultiple: number | null;
  entryTime: Date;
  exitTime: Date | null;
  initialStopLoss: number | null;
  // Extended fields for new filters
  mae?: number | null;      // Maximum Adverse Excursion
  mfe?: number | null;      // Maximum Favorable Excursion
  volume?: number;
}