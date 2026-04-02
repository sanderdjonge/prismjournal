/**
 * Correlation Matrix for What-If Simulator
 * Calculates correlations between filter combinations and outcomes
 * Phase 29 - Feature 2.38.14
 */

import { TradeData } from './types';

/** Correlation result between two variables */
export interface CorrelationResult {
  variable1: string;
  variable2: string;
  correlation: number;       // -1 to 1
  pValue?: number;          // Statistical significance
  sampleSize: number;
}

/** Correlation matrix cell */
export interface CorrelationCell {
  row: string;
  column: string;
  value: number;
  significance?: 'high' | 'medium' | 'low';
}

/** Full correlation matrix */
export interface CorrelationMatrix {
  variables: string[];
  matrix: CorrelationCell[][];
  generatedAt: Date;
  tradeCount: number;
}

/** Filter outcome for correlation analysis */
export interface FilterOutcome {
  filterName: string;
  filterValue: string | number | boolean;
  pnl: number;
  rMultiple: number;
  win: boolean;
}

/**
 * Calculate Pearson correlation coefficient
 */
export function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n !== y.length || n === 0) return 0;
  
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
  const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);
  const sumY2 = y.reduce((acc, yi) => acc + yi * yi, 0);
  
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  
  if (denominator === 0) return 0;
  
  return numerator / denominator;
}

/**
 * Convert filter value to numeric for correlation
 */
function toNumeric(value: string | number | boolean): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  // Hash string to number for categorical correlation
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) - hash) + value.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

/**
 * Build correlation matrix from trades and filter outcomes
 */
export function buildCorrelationMatrix(
  trades: TradeData[],
  filterOutcomes: FilterOutcome[][]
): CorrelationMatrix {
  // Extract unique filter names
  const filterNames = new Set<string>();
  filterOutcomes.forEach(outcomes => {
    outcomes.forEach(o => filterNames.add(o.filterName));
  });
  
  // Add outcome variables
  const variables = ['pnl', 'rMultiple', 'win', ...Array.from(filterNames)];
  
  // Build data arrays for each variable
  const data: Record<string, number[]> = {
    pnl: [],
    rMultiple: [],
    win: [],
  };
  
  // Initialize filter data arrays
  filterNames.forEach(name => {
    data[name] = [];
  });
  
  // Populate data arrays
  trades.forEach((trade, i) => {
    data.pnl.push(trade.pnl ?? 0);
    data.rMultiple.push(trade.rMultiple ?? 0);
    data.win.push((trade.pnl ?? 0) > 0 ? 1 : 0);
    
    const outcomes = filterOutcomes[i] || [];
    filterNames.forEach(name => {
      const outcome = outcomes.find(o => o.filterName === name);
      data[name].push(outcome ? toNumeric(outcome.filterValue) : 0);
    });
  });
  
  // Build matrix
  const matrix: CorrelationCell[][] = [];
  
  variables.forEach((rowVar, rowIndex) => {
    matrix[rowIndex] = [];
    variables.forEach((colVar, colIndex) => {
      const correlation = pearsonCorrelation(data[rowVar], data[colVar]);
      
      let significance: 'high' | 'medium' | 'low' | undefined;
      const absCorr = Math.abs(correlation);
      if (absCorr >= 0.7) significance = 'high';
      else if (absCorr >= 0.4) significance = 'medium';
      else if (absCorr >= 0.2) significance = 'low';
      
      matrix[rowIndex][colIndex] = {
        row: rowVar,
        column: colVar,
        value: correlation,
        significance,
      };
    });
  });
  
  return {
    variables,
    matrix,
    generatedAt: new Date(),
    tradeCount: trades.length,
  };
}

/**
 * Analyze filter effectiveness
 * Returns which filters have highest correlation with positive outcomes
 */
export function analyzeFilterEffectiveness(
  matrix: CorrelationMatrix
): Array<{ filter: string; correlationWithWin: number; effectiveness: 'positive' | 'negative' | 'neutral' }> {
  const winIndex = matrix.variables.indexOf('win');
  const pnlIndex = matrix.variables.indexOf('pnl');
  
  return matrix.variables
    .filter(v => v !== 'pnl' && v !== 'rMultiple' && v !== 'win')
    .map(filter => {
      const filterIndex = matrix.variables.indexOf(filter);
      const corrWithWin = matrix.matrix[filterIndex][winIndex].value;
      const corrWithPnl = matrix.matrix[filterIndex][pnlIndex].value;
      
      // Average correlation with positive outcomes
      const avgCorr = (corrWithWin + corrWithPnl) / 2;
      
      let effectiveness: 'positive' | 'negative' | 'neutral';
      if (avgCorr > 0.1) effectiveness = 'positive';
      else if (avgCorr < -0.1) effectiveness = 'negative';
      else effectiveness = 'neutral';
      
      return {
        filter,
        correlationWithWin: corrWithWin,
        effectiveness,
      };
    })
    .sort((a, b) => Math.abs(b.correlationWithWin) - Math.abs(a.correlationWithWin));
}

/**
 * Find optimal filter combinations
 * Based on correlation with wins
 */
export function findOptimalCombinations(
  trades: TradeData[],
  filterOutcomes: FilterOutcome[][],
  topN: number = 5
): Array<{
  filters: Record<string, string | number | boolean>;
  avgR: number;
  winRate: number;
  tradeCount: number;
}> {
  // Group trades by filter combinations
  const combinations = new Map<string, {
    filters: Record<string, string | number | boolean>;
    trades: TradeData[];
  }>();
  
  trades.forEach((trade, i) => {
    const outcomes = filterOutcomes[i] || [];
    if (outcomes.length === 0) return;
    
    // Create key from filter combination
    const key = outcomes
      .map(o => `${o.filterName}=${o.filterValue}`)
      .sort()
      .join('|');
    
    if (!combinations.has(key)) {
      combinations.set(key, {
        filters: outcomes.reduce((acc, o) => {
          acc[o.filterName] = o.filterValue;
          return acc;
        }, {} as Record<string, string | number | boolean>),
        trades: [],
      });
    }
    
    combinations.get(key)!.trades.push(trade);
  });
  
  // Calculate metrics for each combination
  const results = Array.from(combinations.values())
    .map(({ filters, trades: comboTrades }) => {
      const totalR = comboTrades.reduce((sum, t) => sum + (t.rMultiple ?? 0), 0);
      const avgR = totalR / comboTrades.length;
      const wins = comboTrades.filter(t => (t.pnl ?? 0) > 0).length;
      const winRate = wins / comboTrades.length;
      
      return {
        filters,
        avgR,
        winRate,
        tradeCount: comboTrades.length,
      };
    })
    .filter(r => r.tradeCount >= 3) // Require at least 3 trades
    .sort((a, b) => b.avgR - a.avgR)
    .slice(0, topN);
  
  return results;
}

/**
 * Generate filter outcomes from trades
 * Helper for building correlation analysis
 */
export function generateFilterOutcomes(
  trades: TradeData[]
): FilterOutcome[][] {
  return trades.map(trade => {
    const outcomes: FilterOutcome[] = [];
    
    // Session filter outcome
    const hour = new Date(trade.entryTime).getUTCHours();
    let session = 'OTHER';
    if (hour >= 7 && hour < 16) session = 'LONDON';
    if (hour >= 13 && hour < 22) session = 'NEW_YORK';
    if (hour >= 7 && hour < 16 && hour >= 13) session = 'OVERLAP';
    if (hour >= 0 && hour < 9) session = 'ASIA';
    
    outcomes.push({
      filterName: 'session',
      filterValue: session,
      pnl: trade.pnl ?? 0,
      rMultiple: trade.rMultiple ?? 0,
      win: (trade.pnl ?? 0) > 0,
    });
    
    // Day of week outcome
    const day = new Date(trade.entryTime).getUTCDay();
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    outcomes.push({
      filterName: 'dayOfWeek',
      filterValue: days[day],
      pnl: trade.pnl ?? 0,
      rMultiple: trade.rMultiple ?? 0,
      win: (trade.pnl ?? 0) > 0,
    });
    
    // Direction outcome
    outcomes.push({
      filterName: 'direction',
      filterValue: trade.direction,
      pnl: trade.pnl ?? 0,
      rMultiple: trade.rMultiple ?? 0,
      win: (trade.pnl ?? 0) > 0,
    });
    
    // Symbol outcome
    outcomes.push({
      filterName: 'symbol',
      filterValue: trade.symbol,
      pnl: trade.pnl ?? 0,
      rMultiple: trade.rMultiple ?? 0,
      win: (trade.pnl ?? 0) > 0,
    });
    
    // R-multiple outcome (bucketed)
    const rMultiple = trade.rMultiple ?? 0;
    let rBucket = 'LOSS';
    if (rMultiple >= 3) rBucket = 'BIG_WIN';
    else if (rMultiple >= 1) rBucket = 'WIN';
    else if (rMultiple >= 0) rBucket = 'BREAKEVEN';
    
    outcomes.push({
      filterName: 'rBucket',
      filterValue: rBucket,
      pnl: trade.pnl ?? 0,
      rMultiple: trade.rMultiple ?? 0,
      win: (trade.pnl ?? 0) > 0,
    });
    
    return outcomes;
  });
}