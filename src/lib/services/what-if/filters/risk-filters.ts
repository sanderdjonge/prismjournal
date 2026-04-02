/**
 * Risk-based filters for What-If Simulator
 * MAE/MFE Stop Optimization, Position Sizing, Trailing Stops, Partial Exits
 */

import { TradeData } from '../types';

/**
 * MAE (Maximum Adverse Excursion) / MFE (Maximum Favorable Excursion) analysis
 * Used to simulate optimal stop placement
 */
export interface MaeMfeResult {
  tradeId: string;
  mae: number;  // Maximum adverse excursion in R (negative)
  mfe: number;  // Maximum favorable excursion in R (positive)
  pnl: number | null;
  rMultiple: number | null;
}

/**
 * Simulate MAE/MFE-based stop optimization
 * Returns trades that would have survived a tighter stop
 */
export function applyMaeMfeStopOptimization(
  trades: TradeData[],
  params: {
    newStopR: number;     // New stop distance in R (e.g., -1.5 = 1.5R stop)
    targetRatio?: number; // MFE/MAE ratio threshold for inclusion
  }
): TradeData[] {
  const { newStopR, targetRatio } = params;
  
  // Filter trades that have MAE/MFE data
  const tradesWithMaeMfe = trades.filter(t => t.mae !== undefined && t.mfe !== undefined);
  
  if (tradesWithMaeMfe.length === 0) {
    // If no MAE/MFE data, use statistical approximation
    return simulateMaeMfeFromTrades(trades, newStopR);
  }
  
  return tradesWithMaeMfe.filter(trade => {
    const mae = trade.mae!;
    const mfe = trade.mfe!;
    
    // Trade would be stopped out if MAE exceeds new stop
    if (mae < newStopR) {
      return false;
    }
    
    // If target ratio specified, check MFE/MAE ratio
    if (targetRatio && mae !== 0) {
      const ratio = mfe / Math.abs(mae);
      if (ratio < targetRatio) {
        return false;
      }
    }
    
    return true;
  });
}

/**
 * Deterministic hash function for generating consistent values from trade ID
 */
function hashTradeId(tradeId: string): number {
  let hash = 0;
  for (let i = 0; i < tradeId.length; i++) {
    const char = tradeId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Statistical approximation of MAE/MFE when actual data not available
 * Based on trade duration, volatility, and outcome
 *
 * Task 2: Fixed - now deterministic using trade ID hash instead of Math.random()
 */
function simulateMaeMfeFromTrades(trades: TradeData[], newStopR: number): TradeData[] {
  return trades.filter(trade => {
    // If no MAE/MFE, we approximate:
    // - Winning trades: MAE typically 0.3-0.7R, MFE = R-multiple
    // - Losing trades: MAE = R-multiple (hit stop), MFE typically 0.1-0.5R
    
    const rMultiple = trade.rMultiple ?? 0;
    
    if (rMultiple >= 0) {
      // Winner - assume it survived the stop
      // Only filter if newStopR would have stopped it out
      // Task 2: Use deterministic hash instead of Math.random()
      const hash = hashTradeId(trade.id);
      const normalizedHash = (hash % 1000) / 1000; // 0.0 to 0.999
      // Simulated MAE: deterministic value between -0.3R and -0.7R
      const estimatedMae = -(0.3 + normalizedHash * 0.4);
      return estimatedMae >= newStopR;
    } else {
      // Loser - check if tighter stop would have reduced loss
      // If newStopR > rMultiple, trade would exit earlier with smaller loss
      // We keep the trade but modify its outcome in the simulation
      return true; // Keep all losers for now - they'd exit at newStopR
    }
  });
}

/**
 * Apply position sizing what-if
 * Scales trade outcomes based on new risk percentage
 */
export function applyPositionSizing(
  trades: TradeData[],
  params: {
    originalRiskPercent: number;  // Original risk per trade (e.g., 1.0 = 1%)
    newRiskPercent: number;       // New risk per trade
  }
): TradeData[] {
  const { originalRiskPercent, newRiskPercent } = params;
  const scaleFactor = newRiskPercent / originalRiskPercent;
  
  return trades.map(trade => ({
    ...trade,
    pnl: trade.pnl !== null ? trade.pnl * scaleFactor : null,
    // rMultiple stays the same since it's relative to risk
  }));
}

/**
 * Apply trailing stop simulation
 * Simulates exiting when price retraces X% from MFE
 */
export function applyTrailingStop(
  trades: TradeData[],
  params: {
    trailPercent: number;  // Retracement percentage from peak (e.g., 0.5 = 50%)
    minProfitR?: number;   // Minimum profit in R before trailing activates
  }
): TradeData[] {
  const { trailPercent, minProfitR = 0 } = params;
  
  return trades.map(trade => {
    const mfe = trade.mfe;
    const rMultiple = trade.rMultiple ?? 0;
    
    // Only apply trailing stop to winning trades
    if (rMultiple <= 0) {
      return trade;
    }
    
    // If no MFE data, use approximation for winners
    if (mfe === undefined || mfe === null) {
      if (rMultiple > minProfitR) {
        // Approximate: winner gave back some profit
        // Simulate trailing exit at peak * (1 - trailPercent)
        const simulatedExit = rMultiple * (1 - trailPercent);
        return {
          ...trade,
          pnl: trade.pnl !== null ? trade.pnl * (simulatedExit / rMultiple) : null,
          rMultiple: simulatedExit,
        };
      }
      return trade;
    }
    
    // Only trail if MFE exceeds minimum
    if (mfe <= minProfitR) {
      return trade;
    }
    
    // Calculate trailing exit point
    const trailingExit = mfe * (1 - trailPercent);
    
    // If trailing exit is better than actual outcome, use it
    if (trailingExit > rMultiple) {
      return {
        ...trade,
        pnl: trade.pnl !== null ? trade.pnl * (trailingExit / rMultiple) : null,
        rMultiple: trailingExit,
      };
    }
    
    return trade;
  });
}

/**
 * Apply partial exit simulation
 * Takes partial profits at target levels
 */
export function applyPartialExit(
  trades: TradeData[],
  params: {
    exitSchedule: Array<{
      rLevel: number;    // R level to take partial
      percent: number;   // Percentage of position to close
    }>;
  }
): TradeData[] {
  const { exitSchedule } = params;
  
  // Sort schedule by R level
  const sortedSchedule = [...exitSchedule].sort((a, b) => a.rLevel - b.rLevel);
  
  return trades.map(trade => {
    const rMultiple = trade.rMultiple ?? 0;
    
    // Only applies to winning trades
    if (rMultiple <= 0) {
      return trade;
    }
    
    let totalRealized = 0;
    let remainingPercent = 100;
    
    for (const exit of sortedSchedule) {
      if (rMultiple >= exit.rLevel && remainingPercent > 0) {
        // This exit level was hit
        const closedPercent = Math.min(exit.percent, remainingPercent);
        totalRealized += exit.rLevel * (closedPercent / 100);
        remainingPercent -= closedPercent;
      }
    }
    
    // Remaining position closes at actual exit
    const finalR = rMultiple * (remainingPercent / 100);
    const totalR = totalRealized + finalR;
    
    // Calculate new PnL based on R change
    const pnlRatio = totalR / rMultiple;
    
    return {
      ...trade,
      pnl: trade.pnl !== null ? trade.pnl * pnlRatio : null,
      rMultiple: totalR,
    };
  });
}

/**
 * Risk per trade adjuster - dynamically scale risk based on equity curve
 */
export function applyDynamicRiskSizing(
  trades: TradeData[],
  params: {
    baseRiskPercent: number;
    maxRiskPercent: number;
    minRiskPercent: number;
    lookbackTrades: number;  // Number of trades to calculate equity curve slope
  }
): TradeData[] {
  const { baseRiskPercent, maxRiskPercent, minRiskPercent, lookbackTrades } = params;
  
  const sortedTrades = [...trades]
    .filter(t => t.exitTime)
    .sort((a, b) => new Date(a.exitTime!).getTime() - new Date(b.exitTime!).getTime());
  
  let equity = 100; // Starting equity (percentage)
  const equityCurve: number[] = [equity];
  const result: TradeData[] = [];
  
  for (let i = 0; i < sortedTrades.length; i++) {
    const trade = sortedTrades[i];
    const pnl = trade.pnl ?? 0;
    const rMultiple = trade.rMultiple ?? 0;
    
    // Calculate current risk based on recent performance
    let currentRisk = baseRiskPercent;
    
    if (i >= lookbackTrades) {
      // Calculate equity curve slope over lookback period
      const recentEquity = equityCurve.slice(-lookbackTrades);
      const slope = (recentEquity[recentEquity.length - 1] - recentEquity[0]) / lookbackTrades;
      
      // Adjust risk: increase if positive slope, decrease if negative
      if (slope > 0.5) {
        currentRisk = Math.min(maxRiskPercent, baseRiskPercent * 1.5);
      } else if (slope < -0.5) {
        currentRisk = Math.max(minRiskPercent, baseRiskPercent * 0.5);
      }
    }
    
    // Scale PnL based on current risk
    const riskRatio = currentRisk / baseRiskPercent;
    const scaledPnl = pnl * riskRatio;
    
    result.push({
      ...trade,
      pnl: scaledPnl,
    });
    
    // Update equity curve
    equity += scaledPnl;
    equityCurve.push(equity);
  }
  
  return result;
}