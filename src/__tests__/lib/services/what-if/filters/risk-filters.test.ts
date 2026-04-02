import { describe, it, expect } from 'vitest';
import { 
  applyMaeMfeStopOptimization,
  applyPositionSizing,
  applyTrailingStop,
  applyPartialExit,
  applyDynamicRiskSizing,
  MaeMfeResult
} from '@/lib/services/what-if/filters/risk-filters';
import { TradeData } from '@/lib/services/what-if/types';

describe('Risk Filters', () => {
  describe('applyMaeMfeStopOptimization', () => {
    const tradesWithMaeMfe: TradeData[] = [
      { id: '1', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.12, stopLoss: 1.09, takeProfit: 1.12, pnl: 200, rMultiple: 2, entryTime: new Date('2026-04-01T10:00:00Z'), exitTime: new Date('2026-04-01T11:00:00Z'), initialStopLoss: 1.09, mae: -0.5, mfe: 2.5 }, // Good trade
      { id: '2', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.09, stopLoss: 1.09, takeProfit: 1.12, pnl: -100, rMultiple: -1, entryTime: new Date('2026-04-01T12:00:00Z'), exitTime: new Date('2026-04-01T13:00:00Z'), initialStopLoss: 1.09, mae: -1.2, mfe: 0.3 }, // Hit stop, MAE exceeded
      { id: '3', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.105, stopLoss: 1.09, takeProfit: 1.12, pnl: 50, rMultiple: 0.5, entryTime: new Date('2026-04-01T14:00:00Z'), exitTime: new Date('2026-04-01T15:00:00Z'), initialStopLoss: 1.09, mae: -0.8, mfe: 1.0 }, // Scratch trade
      { id: '4', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.115, stopLoss: 1.09, takeProfit: 1.12, pnl: 150, rMultiple: 1.5, entryTime: new Date('2026-04-01T16:00:00Z'), exitTime: new Date('2026-04-01T17:00:00Z'), initialStopLoss: 1.09, mae: -2.0, mfe: 2.0 }, // Deep drawdown but won
    ];
    
    it('should filter trades where MAE exceeds new stop', () => {
      // New stop at -1.5R
      const result = applyMaeMfeStopOptimization(tradesWithMaeMfe, { newStopR: -1.5 });
      
      // Trade 4 has MAE -2.0 which exceeds -1.5, should be filtered
      expect(result.map(t => t.id)).toEqual(['1', '2', '3']);
    });
    
    it('should keep all trades if new stop is very wide', () => {
      const result = applyMaeMfeStopOptimization(tradesWithMaeMfe, { newStopR: -3.0 });
      
      expect(result).toHaveLength(4);
    });
    
    it('should filter by MFE/MAE ratio when specified', () => {
      // Target ratio of 2.0 means MFE must be 2x |MAE|
      const result = applyMaeMfeStopOptimization(tradesWithMaeMfe, { 
        newStopR: -3.0,
        targetRatio: 2.0 
      });
      
      // Trade 1: MFE/MAE = 2.5/0.5 = 5.0 ✓
      // Trade 2: MFE/MAE = 0.3/1.2 = 0.25 ✗
      // Trade 3: MFE/MAE = 1.0/0.8 = 1.25 ✗
      // Trade 4: MFE/MAE = 2.0/2.0 = 1.0 ✗
      expect(result.map(t => t.id)).toEqual(['1']);
    });
    
    it('should handle trades without MAE/MFE data', () => {
      const tradesWithoutMaeMfe: TradeData[] = [
        { id: '1', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.12, stopLoss: 1.09, takeProfit: 1.12, pnl: 200, rMultiple: 2, entryTime: new Date('2026-04-01T10:00:00Z'), exitTime: new Date('2026-04-01T11:00:00Z'), initialStopLoss: 1.09 },
        { id: '2', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.09, stopLoss: 1.09, takeProfit: 1.12, pnl: -100, rMultiple: -1, entryTime: new Date('2026-04-01T12:00:00Z'), exitTime: new Date('2026-04-01T13:00:00Z'), initialStopLoss: 1.09 },
      ];
      
      // Should use statistical approximation
      const result = applyMaeMfeStopOptimization(tradesWithoutMaeMfe, { newStopR: -1.0 });
      
      // Approximation keeps all trades (winners assumed to survive, losers would exit earlier)
      expect(result.length).toBeGreaterThanOrEqual(1);
    });
  });
  
  describe('applyPositionSizing', () => {
    const trades: TradeData[] = [
      { id: '1', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.12, stopLoss: 1.09, takeProfit: 1.12, pnl: 100, rMultiple: 1, entryTime: new Date('2026-04-01T10:00:00Z'), exitTime: new Date('2026-04-01T11:00:00Z'), initialStopLoss: 1.09 },
      { id: '2', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.09, stopLoss: 1.09, takeProfit: 1.12, pnl: -100, rMultiple: -1, entryTime: new Date('2026-04-01T12:00:00Z'), exitTime: new Date('2026-04-01T13:00:00Z'), initialStopLoss: 1.09 },
      { id: '3', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.13, stopLoss: 1.09, takeProfit: 1.13, pnl: 300, rMultiple: 3, entryTime: new Date('2026-04-01T14:00:00Z'), exitTime: new Date('2026-04-01T15:00:00Z'), initialStopLoss: 1.09 },
    ];
    
    it('should scale PnL by risk factor', () => {
      // Double the risk (1% -> 2%)
      const result = applyPositionSizing(trades, { 
        originalRiskPercent: 1.0, 
        newRiskPercent: 2.0 
      });
      
      expect(result[0].pnl).toBe(200);  // 100 * 2
      expect(result[1].pnl).toBe(-200); // -100 * 2
      expect(result[2].pnl).toBe(600);  // 300 * 2
    });
    
    it('should reduce PnL when decreasing risk', () => {
      // Half the risk (1% -> 0.5%)
      const result = applyPositionSizing(trades, { 
        originalRiskPercent: 1.0, 
        newRiskPercent: 0.5 
      });
      
      expect(result[0].pnl).toBe(50);   // 100 * 0.5
      expect(result[1].pnl).toBe(-50);  // -100 * 0.5
      expect(result[2].pnl).toBe(150);  // 300 * 0.5
    });
    
    it('should preserve rMultiple', () => {
      const result = applyPositionSizing(trades, { 
        originalRiskPercent: 1.0, 
        newRiskPercent: 2.0 
      });
      
      // rMultiple stays same since it's relative to risk
      expect(result[0].rMultiple).toBe(1);
      expect(result[1].rMultiple).toBe(-1);
      expect(result[2].rMultiple).toBe(3);
    });
    
    it('should handle null PnL', () => {
      const openTrades: TradeData[] = [
        { id: '1', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: null, stopLoss: 1.09, takeProfit: 1.12, pnl: null, rMultiple: null, entryTime: new Date('2026-04-01T10:00:00Z'), exitTime: null, initialStopLoss: 1.09 },
      ];
      
      const result = applyPositionSizing(openTrades, { 
        originalRiskPercent: 1.0, 
        newRiskPercent: 2.0 
      });
      
      expect(result[0].pnl).toBe(null);
    });
  });
  
  describe('applyTrailingStop', () => {
    const tradesWithMfe: TradeData[] = [
      { id: '1', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.12, stopLoss: 1.09, takeProfit: 1.12, pnl: 100, rMultiple: 1, entryTime: new Date('2026-04-01T10:00:00Z'), exitTime: new Date('2026-04-01T11:00:00Z'), initialStopLoss: 1.09, mfe: 2.0 }, // MFE 2R, exited at 1R
      { id: '2', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.09, stopLoss: 1.09, takeProfit: 1.12, pnl: -100, rMultiple: -1, entryTime: new Date('2026-04-01T12:00:00Z'), exitTime: new Date('2026-04-01T13:00:00Z'), initialStopLoss: 1.09, mfe: 0.3 }, // Loser
      { id: '3', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.115, stopLoss: 1.09, takeProfit: 1.12, pnl: 150, rMultiple: 1.5, entryTime: new Date('2026-04-01T14:00:00Z'), exitTime: new Date('2026-04-01T15:00:00Z'), initialStopLoss: 1.09, mfe: 3.0 }, // MFE 3R, exited at 1.5R
    ];
    
    it('should improve exit when trailing would have helped', () => {
      // 50% trail from peak
      const result = applyTrailingStop(tradesWithMfe, { trailPercent: 0.5 });
      
      // Trade 1: MFE 2R, trail at 1R, actual exit 1R -> same
      expect(result[0].rMultiple).toBe(1);
      
      // Trade 2: Loser, no change
      expect(result[1].rMultiple).toBe(-1);
      
      // Trade 3: MFE 3R, trail at 1.5R, actual exit 1.5R -> same (already at 1.5R)
      // Wait, if MFE was 3R and we trail at 50%, exit would be 1.5R
      // Actual exit was 1.5R, so same
      expect(result[2].rMultiple).toBe(1.5);
    });
    
    it('should apply minimum profit threshold before trailing', () => {
      const result = applyTrailingStop(tradesWithMfe, { 
        trailPercent: 0.5, 
        minProfitR: 2.0 
      });
      
      // Trade 1: MFE 2R hits threshold, trail at 1R
      expect(result[0].rMultiple).toBe(1); // Trailing kicks in
      
      // Trade 3: MFE 3R, trail at 1.5R
      expect(result[2].rMultiple).toBe(1.5);
    });
    
    it('should handle tighter trailing', () => {
      // 25% trail - closer to peak
      const result = applyTrailingStop(tradesWithMfe, { trailPercent: 0.25 });
      
      // Trade 3: MFE 3R, trail at 2.25R, better than 1.5R
      expect(result[2].rMultiple).toBe(2.25);
    });
    
    it('should handle trades without MFE', () => {
      const tradesWithoutMfe: TradeData[] = [
        { id: '1', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.12, stopLoss: 1.09, takeProfit: 1.12, pnl: 200, rMultiple: 2, entryTime: new Date('2026-04-01T10:00:00Z'), exitTime: new Date('2026-04-01T11:00:00Z'), initialStopLoss: 1.09 },
      ];
      
      const result = applyTrailingStop(tradesWithoutMfe, { trailPercent: 0.5 });
      
      // Should use approximation
      expect(result[0].rMultiple).toBeLessThan(2);
      expect(result[0].rMultiple).toBeGreaterThan(0);
    });
  });
  
  describe('applyPartialExit', () => {
    const trades: TradeData[] = [
      { id: '1', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.12, stopLoss: 1.09, takeProfit: 1.12, pnl: 100, rMultiple: 1, entryTime: new Date('2026-04-01T10:00:00Z'), exitTime: new Date('2026-04-01T11:00:00Z'), initialStopLoss: 1.09 },
      { id: '2', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.13, stopLoss: 1.09, takeProfit: 1.13, pnl: 300, rMultiple: 3, entryTime: new Date('2026-04-01T12:00:00Z'), exitTime: new Date('2026-04-01T13:00:00Z'), initialStopLoss: 1.09 },
      { id: '3', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.09, stopLoss: 1.09, takeProfit: 1.12, pnl: -100, rMultiple: -1, entryTime: new Date('2026-04-01T14:00:00Z'), exitTime: new Date('2026-04-01T15:00:00Z'), initialStopLoss: 1.09 },
    ];
    
    it('should apply partial exits at R levels', () => {
      // Exit 50% at 1R, 50% at 2R
      const result = applyPartialExit(trades, {
        exitSchedule: [
          { rLevel: 1, percent: 50 },
          { rLevel: 2, percent: 50 },
        ]
      });
      
      // Trade 1: R=1, exits 50% at 1R, 50% remaining at 1R
      // Total: 1*0.5 + 1*0.5 = 1R (same)
      expect(result[0].rMultiple).toBe(1);
      
      // Trade 2: R=3, exits 50% at 1R, 50% at 2R (both hit)
      // But remaining position would close at 3R
      // Wait: 50% at 1R, 50% at 2R = 100% closed before 3R
      // Actually, need to recalculate:
      // First exit: 50% at 1R = 0.5R realized
      // Second exit: 50% at 2R = 1.0R realized
      // Total = 1.5R
      expect(result[1].rMultiple).toBe(1.5);
      
      // Trade 3: Loser, no change
      expect(result[2].rMultiple).toBe(-1);
    });
    
    it('should handle single partial exit', () => {
      const result = applyPartialExit(trades, {
        exitSchedule: [{ rLevel: 2, percent: 50 }]
      });
      
      // Trade 1: R=1, didn't hit 2R level
      expect(result[0].rMultiple).toBe(1);
      
      // Trade 2: R=3, exits 50% at 2R, 50% remaining at 3R
      // Total: 2*0.5 + 3*0.5 = 2.5R
      expect(result[1].rMultiple).toBe(2.5);
    });
    
    it('should handle overlapping exit percentages', () => {
      // Over-specified exits (total > 100%)
      const result = applyPartialExit([trades[1]], {
        exitSchedule: [
          { rLevel: 1, percent: 60 },
          { rLevel: 2, percent: 60 },
        ]
      });
      
      // First exit: 60% at 1R = 0.6R realized, 40% remaining
      // Second exit: tries 60% but only 40% remaining = 0.8R realized
      // Total: 0.6 + 0.8 = 1.4R
      expect(result[0].rMultiple).toBe(1.4);
    });
    
    it('should not modify losing trades', () => {
      const result = applyPartialExit([trades[2]], {
        exitSchedule: [{ rLevel: 1, percent: 50 }]
      });
      
      expect(result[0].rMultiple).toBe(-1);
    });
  });
  
  describe('applyDynamicRiskSizing', () => {
    const trades: TradeData[] = [
      { id: '1', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.12, stopLoss: 1.09, takeProfit: 1.12, pnl: 100, rMultiple: 1, entryTime: new Date('2026-04-01T10:00:00Z'), exitTime: new Date('2026-04-01T11:00:00Z'), initialStopLoss: 1.09 },
      { id: '2', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.12, stopLoss: 1.09, takeProfit: 1.12, pnl: 100, rMultiple: 1, entryTime: new Date('2026-04-01T12:00:00Z'), exitTime: new Date('2026-04-01T13:00:00Z'), initialStopLoss: 1.09 },
      { id: '3', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.12, stopLoss: 1.09, takeProfit: 1.12, pnl: 100, rMultiple: 1, entryTime: new Date('2026-04-01T14:00:00Z'), exitTime: new Date('2026-04-01T15:00:00Z'), initialStopLoss: 1.09 },
      { id: '4', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.12, stopLoss: 1.09, takeProfit: 1.12, pnl: 100, rMultiple: 1, entryTime: new Date('2026-04-01T16:00:00Z'), exitTime: new Date('2026-04-01T17:00:00Z'), initialStopLoss: 1.09 },
      { id: '5', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.09, stopLoss: 1.09, takeProfit: 1.12, pnl: -100, rMultiple: -1, entryTime: new Date('2026-04-01T18:00:00Z'), exitTime: new Date('2026-04-01T19:00:00Z'), initialStopLoss: 1.09 },
      { id: '6', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.09, stopLoss: 1.09, takeProfit: 1.12, pnl: -100, rMultiple: -1, entryTime: new Date('2026-04-01T20:00:00Z'), exitTime: new Date('2026-04-01T21:00:00Z'), initialStopLoss: 1.09 },
    ];
    
    it('should use base risk for initial trades', () => {
      const result = applyDynamicRiskSizing(trades, {
        baseRiskPercent: 1.0,
        maxRiskPercent: 2.0,
        minRiskPercent: 0.5,
        lookbackTrades: 3
      });
      
      // First few trades use base risk
      expect(result[0].pnl).toBe(100);
      expect(result[1].pnl).toBe(100);
      expect(result[2].pnl).toBe(100);
    });
    
    it('should increase risk after winning streak', () => {
      const result = applyDynamicRiskSizing(trades, {
        baseRiskPercent: 1.0,
        maxRiskPercent: 2.0,
        minRiskPercent: 0.5,
        lookbackTrades: 3
      });
      
      // Trade 4: after 3 winners, slope is positive
      // Risk should increase to 1.5%
      expect(result[3].pnl).toBe(150); // 100 * 1.5
    });
    
    it('should scale all trades after lookback period', () => {
      const result = applyDynamicRiskSizing(trades, {
        baseRiskPercent: 1.0,
        maxRiskPercent: 2.0,
        minRiskPercent: 0.5,
        lookbackTrades: 3
      });
      
      // Trade 5: continues with increased risk (equity slope still positive)
      // After 4 winners with one at 1.5x risk, equity is still rising
      expect(result[4].pnl).toBe(-150); // -100 * 1.5 (increased risk)
    });
    
    it('should respect risk limits', () => {
      const allWinners: TradeData[] = Array(10).fill(null).map((_, i) => ({
        id: String(i + 1),
        symbol: 'EURUSD',
        direction: 'LONG' as const,
        entryPrice: 1.1,
        exitPrice: 1.12,
        stopLoss: 1.09,
        takeProfit: 1.12,
        pnl: 200,
        rMultiple: 2,
        entryTime: new Date(`2026-04-0${1 + Math.floor(i/5)}T${10 + i}:00:00Z`),
        exitTime: new Date(`2026-04-0${1 + Math.floor(i/5)}T${11 + i}:00:00Z`),
        initialStopLoss: 1.09
      }));
      
      const result = applyDynamicRiskSizing(allWinners, {
        baseRiskPercent: 1.0,
        maxRiskPercent: 1.5,
        minRiskPercent: 0.5,
        lookbackTrades: 3
      });
      
      // After winning streak, risk caps at max
      const lastTradePnl = result[result.length - 1].pnl!;
      expect(lastTradePnl).toBeLessThanOrEqual(300); // 200 * 1.5
    });
  });
});