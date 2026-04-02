/**
 * What-If Simulator Service
 * Main entry point for Phases 27-29
 */

// Types
export * from './types';

// Error handling
export * from './error-handling';

// Filter modules
export * from './filters';

// Correlation matrix
export * from './correlation-matrix';

// Re-export common types at top level
import { TradeData, WhatIfFilters, TimeFilters, RiskFilters, PsychologyFilters, MarketFilters } from './types';

// ESM imports for filter functions (Task 1: replace require() with imports)
import {
  applyDurationFilter,
  applyMarketSessionFilter,
  applyDayFilter,
  applyHourFilter,
} from './filters/time-filters';

import {
  applyDailyLossLimit,
  applyWeeklyLossLimit,
  applyStreakBreak,
  applyBigLossCooldown,
} from './filters/psychology-filters';

import {
  applyPositionSizing,
  applyTrailingStop,
  applyPartialExit,
} from './filters/risk-filters';

import {
  applyVolatilityFilterSync,
  applyNewsEventFilterSync,
} from './filters/market-filters';

/**
 * Main What-If Simulator class
 * Orchestrates all filters and provides unified interface
 */
export class WhatIfSimulator {
  private trades: TradeData[];
  private filters: WhatIfFilters;
  
  constructor(trades: TradeData[], filters: WhatIfFilters = {}) {
    this.trades = trades;
    this.filters = filters;
  }
  
  /**
   * Apply all configured filters
   */
  applyFilters(): TradeData[] {
    let result = [...this.trades];
    
    // Apply time filters
    if (this.filters.time) {
      result = this.applyTimeFilters(result, this.filters.time);
    }
    
    // Apply psychology filters
    if (this.filters.psychology) {
      result = this.applyPsychologyFilters(result, this.filters.psychology);
    }
    
    // Apply risk filters
    if (this.filters.risk) {
      result = this.applyRiskFilters(result, this.filters.risk);
    }
    
    // Apply market filters (Task 8: add market filters)
    if (this.filters.market) {
      result = this.applyMarketFilters(result, this.filters.market);
    }
    
    return result;
  }
  
  private applyTimeFilters(trades: TradeData[], filters: TimeFilters): TradeData[] {
    let result = trades;
    
    if (filters.maxDurationHours || filters.minDurationHours) {
      result = applyDurationFilter(result, {
        maxHours: filters.maxDurationHours,
        minHours: filters.minDurationHours,
      });
    }
    
    if (filters.marketSession?.length) {
      result = applyMarketSessionFilter(result, filters.marketSession);
    }
    
    if (filters.excludeDays?.length) {
      result = applyDayFilter(result, filters.excludeDays);
    }
    
    if (filters.excludeHours?.length) {
      result = applyHourFilter(result, filters.excludeHours);
    }
    
    return result;
  }
  
  private applyPsychologyFilters(trades: TradeData[], filters: PsychologyFilters): TradeData[] {
    let result = trades;
    
    if (filters.dailyLossLimit) {
      result = applyDailyLossLimit(result, filters.dailyLossLimit);
    }
    
    if (filters.weeklyLossLimit) {
      result = applyWeeklyLossLimit(result, filters.weeklyLossLimit);
    }
    
    if (filters.stopAfterLosses) {
      result = applyStreakBreak(result, filters.stopAfterLosses);
    }
    
    if (filters.avoidAfterBigLoss) {
      result = applyBigLossCooldown(result, filters.avoidAfterBigLoss);
    }
    
    return result;
  }
  
  private applyRiskFilters(trades: TradeData[], filters: RiskFilters): TradeData[] {
    let result = trades;
    
    if (filters.riskPerTrade) {
      result = applyPositionSizing(result, {
        originalRiskPercent: 1.0,
        newRiskPercent: filters.riskPerTrade,
      });
    }
    
    if (filters.trailingPercent) {
      result = applyTrailingStop(result, {
        trailPercent: filters.trailingPercent,
      });
    }
    
    if (filters.partialExitAt) {
      result = applyPartialExit(result, {
        exitSchedule: [filters.partialExitAt],
      });
    }
    
    return result;
  }
  
  private applyMarketFilters(trades: TradeData[], filters: MarketFilters): TradeData[] {
    let result = trades;
    
    // Volatility filter
    if (filters.minVolatility !== undefined || filters.maxVolatility !== undefined) {
      const mode = filters.maxVolatility !== undefined ? 'avoid' : 'prefer';
      const threshold = filters.maxVolatility ?? filters.minVolatility ?? 0.5;
      
      // For sync version, we need volatility data - pass empty map to fail-open for now
      // In production, this would be pre-populated from Twelve Data API
      result = applyVolatilityFilterSync(result, {
        mode,
        atrPercentThreshold: threshold,
      }, new Map());
    }
    
    // News event filter
    if (filters.avoidNewsEvents) {
      const windowMinutes = filters.newsBufferMinutes ?? 30;
      // For sync version, we need news data - pass empty array to fail-open for now
      // In production, this would be pre-populated from MT5 Bridge
      result = applyNewsEventFilterSync(result, {
        avoidHighImpact: true,
        avoidMediumImpact: false,
        windowMinutes,
      }, []);
    }
    
    return result;
  }
  
  /**
   * Calculate statistics for current trades
   */
  getStatistics(): {
    totalTrades: number;
    totalPnL: number;
    winRate: number;
    avgR: number;
    profitFactor: number;
  } {
    const closedTrades = this.trades.filter(t => t.pnl !== null);
    
    if (closedTrades.length === 0) {
      return {
        totalTrades: 0,
        totalPnL: 0,
        winRate: 0,
        avgR: 0,
        profitFactor: 0,
      };
    }
    
    const wins = closedTrades.filter(t => (t.pnl ?? 0) > 0);
    // Task 5: Fix breakeven classification - use < 0, not <= 0
    const losses = closedTrades.filter(t => (t.pnl ?? 0) < 0);
    
    const totalPnL = closedTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
    const totalWins = wins.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
    const totalLosses = Math.abs(losses.reduce((sum, t) => sum + (t.pnl ?? 0), 0));
    const totalR = closedTrades.reduce((sum, t) => sum + (t.rMultiple ?? 0), 0);
    
    return {
      totalTrades: closedTrades.length,
      totalPnL,
      winRate: wins.length / closedTrades.length,
      avgR: totalR / closedTrades.length,
      profitFactor: totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0,
    };
  }
}

/**
 * Create a What-If simulator instance
 */
export function createWhatIfSimulator(
  trades: TradeData[],
  filters?: WhatIfFilters
): WhatIfSimulator {
  return new WhatIfSimulator(trades, filters);
}