import { describe, it, expect } from 'vitest';
import {
  pearsonCorrelation,
  buildCorrelationMatrix,
  analyzeFilterEffectiveness,
  findOptimalCombinations,
  generateFilterOutcomes,
  FilterOutcome
} from '@/lib/services/what-if/correlation-matrix';
import { TradeData } from '@/lib/services/what-if/types';

describe('Correlation Matrix', () => {
  describe('pearsonCorrelation', () => {
    it('should calculate positive correlation', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [2, 4, 6, 8, 10];
      
      const result = pearsonCorrelation(x, y);
      
      expect(result).toBeCloseTo(1.0, 2);
    });
    
    it('should calculate negative correlation', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [10, 8, 6, 4, 2];
      
      const result = pearsonCorrelation(x, y);
      
      expect(result).toBeCloseTo(-1.0, 2);
    });
    
    it('should return near 0 for weak correlation', () => {
      // Use larger dataset with more randomness for weak correlation
      const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const y = [3, 8, 2, 9, 1, 7, 4, 10, 5, 6]; // Random shuffle
      
      const result = pearsonCorrelation(x, y);
      
      // Random data should have weak correlation
      expect(Math.abs(result)).toBeLessThan(0.5);
    });
    
    it('should return 0 for empty arrays', () => {
      const result = pearsonCorrelation([], []);
      
      expect(result).toBe(0);
    });
    
    it('should return 0 for mismatched lengths', () => {
      const result = pearsonCorrelation([1, 2], [1, 2, 3]);
      
      expect(result).toBe(0);
    });
  });
  
  describe('buildCorrelationMatrix', () => {
    const trades: TradeData[] = [
      { id: '1', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.12, stopLoss: 1.09, takeProfit: 1.12, pnl: 100, rMultiple: 1, entryTime: new Date('2026-04-01T10:00:00Z'), exitTime: new Date('2026-04-01T11:00:00Z'), initialStopLoss: 1.09 },
      { id: '2', symbol: 'EURUSD', direction: 'SHORT', entryPrice: 1.1, exitPrice: 1.09, stopLoss: 1.11, takeProfit: 1.09, pnl: 100, rMultiple: 1, entryTime: new Date('2026-04-01T14:00:00Z'), exitTime: new Date('2026-04-01T15:00:00Z'), initialStopLoss: 1.11 },
      { id: '3', symbol: 'GBPUSD', direction: 'LONG', entryPrice: 1.25, exitPrice: 1.24, stopLoss: 1.24, takeProfit: 1.27, pnl: -100, rMultiple: -1, entryTime: new Date('2026-04-02T09:00:00Z'), exitTime: new Date('2026-04-02T10:00:00Z'), initialStopLoss: 1.24 },
    ];
    
    const filterOutcomes: FilterOutcome[][] = [
      [{ filterName: 'testFilter', filterValue: 'A', pnl: 100, rMultiple: 1, win: true }],
      [{ filterName: 'testFilter', filterValue: 'A', pnl: 100, rMultiple: 1, win: true }],
      [{ filterName: 'testFilter', filterValue: 'B', pnl: -100, rMultiple: -1, win: false }],
    ];
    
    it('should build correlation matrix', () => {
      const result = buildCorrelationMatrix(trades, filterOutcomes);
      
      expect(result.variables).toContain('pnl');
      expect(result.variables).toContain('rMultiple');
      expect(result.variables).toContain('win');
      expect(result.variables).toContain('testFilter');
      expect(result.tradeCount).toBe(3);
    });
    
    it('should have correct matrix dimensions', () => {
      const result = buildCorrelationMatrix(trades, filterOutcomes);
      
      const n = result.variables.length;
      expect(result.matrix.length).toBe(n);
      result.matrix.forEach(row => {
        expect(row.length).toBe(n);
      });
    });
    
    it('should have 1.0 correlation on diagonal', () => {
      const result = buildCorrelationMatrix(trades, filterOutcomes);
      
      result.matrix.forEach((row, i) => {
        expect(row[i].value).toBeCloseTo(1.0, 5);
      });
    });
    
    it('should have symmetric matrix', () => {
      const result = buildCorrelationMatrix(trades, filterOutcomes);
      
      result.matrix.forEach((row, i) => {
        row.forEach((cell, j) => {
          expect(cell.value).toBeCloseTo(result.matrix[j][i].value, 5);
        });
      });
    });
    
    it('should set significance levels', () => {
      const result = buildCorrelationMatrix(trades, filterOutcomes);
      
      // Diagonal should have high significance
      result.matrix.forEach((row, i) => {
        expect(row[i].significance).toBe('high');
      });
    });
  });
  
  describe('analyzeFilterEffectiveness', () => {
    const trades: TradeData[] = [
      { id: '1', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.12, stopLoss: 1.09, takeProfit: 1.12, pnl: 100, rMultiple: 1, entryTime: new Date('2026-04-01T10:00:00Z'), exitTime: new Date('2026-04-01T11:00:00Z'), initialStopLoss: 1.09 },
      { id: '2', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.12, stopLoss: 1.09, takeProfit: 1.12, pnl: 100, rMultiple: 1, entryTime: new Date('2026-04-01T14:00:00Z'), exitTime: new Date('2026-04-01T15:00:00Z'), initialStopLoss: 1.09 },
      { id: '3', symbol: 'GBPUSD', direction: 'SHORT', entryPrice: 1.25, exitPrice: 1.24, stopLoss: 1.24, takeProfit: 1.27, pnl: -100, rMultiple: -1, entryTime: new Date('2026-04-02T09:00:00Z'), exitTime: new Date('2026-04-02T10:00:00Z'), initialStopLoss: 1.24 },
    ];
    
    const filterOutcomes: FilterOutcome[][] = [
      [{ filterName: 'goodFilter', filterValue: 1, pnl: 100, rMultiple: 1, win: true }],
      [{ filterName: 'goodFilter', filterValue: 1, pnl: 100, rMultiple: 1, win: true }],
      [{ filterName: 'goodFilter', filterValue: 0, pnl: -100, rMultiple: -1, win: false }],
    ];
    
    it('should analyze filter effectiveness', () => {
      const matrix = buildCorrelationMatrix(trades, filterOutcomes);
      const result = analyzeFilterEffectiveness(matrix);
      
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('filter');
      expect(result[0]).toHaveProperty('correlationWithWin');
      expect(result[0]).toHaveProperty('effectiveness');
    });
    
    it('should sort by absolute correlation', () => {
      const matrix = buildCorrelationMatrix(trades, filterOutcomes);
      const result = analyzeFilterEffectiveness(matrix);
      
      for (let i = 1; i < result.length; i++) {
        expect(Math.abs(result[i - 1].correlationWithWin))
          .toBeGreaterThanOrEqual(Math.abs(result[i].correlationWithWin));
      }
    });
  });
  
  describe('findOptimalCombinations', () => {
    const trades: TradeData[] = [
      { id: '1', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.12, stopLoss: 1.09, takeProfit: 1.12, pnl: 200, rMultiple: 2, entryTime: new Date('2026-04-01T10:00:00Z'), exitTime: new Date('2026-04-01T11:00:00Z'), initialStopLoss: 1.09 },
      { id: '2', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.12, stopLoss: 1.09, takeProfit: 1.12, pnl: 100, rMultiple: 1, entryTime: new Date('2026-04-01T14:00:00Z'), exitTime: new Date('2026-04-01T15:00:00Z'), initialStopLoss: 1.09 },
      { id: '3', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.11, stopLoss: 1.09, takeProfit: 1.11, pnl: 50, rMultiple: 0.5, entryTime: new Date('2026-04-02T10:00:00Z'), exitTime: new Date('2026-04-02T11:00:00Z'), initialStopLoss: 1.09 },
      { id: '4', symbol: 'GBPUSD', direction: 'SHORT', entryPrice: 1.25, exitPrice: 1.24, stopLoss: 1.24, takeProfit: 1.27, pnl: -100, rMultiple: -1, entryTime: new Date('2026-04-02T14:00:00Z'), exitTime: new Date('2026-04-02T15:00:00Z'), initialStopLoss: 1.24 },
      { id: '5', symbol: 'GBPUSD', direction: 'SHORT', entryPrice: 1.25, exitPrice: 1.24, stopLoss: 1.24, takeProfit: 1.27, pnl: -50, rMultiple: -0.5, entryTime: new Date('2026-04-03T09:00:00Z'), exitTime: new Date('2026-04-03T10:00:00Z'), initialStopLoss: 1.24 },
    ];
    
    const filterOutcomes: FilterOutcome[][] = [
      [{ filterName: 'symbol', filterValue: 'EURUSD', pnl: 200, rMultiple: 2, win: true }],
      [{ filterName: 'symbol', filterValue: 'EURUSD', pnl: 100, rMultiple: 1, win: true }],
      [{ filterName: 'symbol', filterValue: 'EURUSD', pnl: 50, rMultiple: 0.5, win: true }],
      [{ filterName: 'symbol', filterValue: 'GBPUSD', pnl: -100, rMultiple: -1, win: false }],
      [{ filterName: 'symbol', filterValue: 'GBPUSD', pnl: -50, rMultiple: -0.5, win: false }],
    ];
    
    it('should find optimal combinations', () => {
      const result = findOptimalCombinations(trades, filterOutcomes, 3);
      
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('filters');
      expect(result[0]).toHaveProperty('avgR');
      expect(result[0]).toHaveProperty('winRate');
      expect(result[0]).toHaveProperty('tradeCount');
    });
    
    it('should sort by average R', () => {
      const result = findOptimalCombinations(trades, filterOutcomes, 3);
      
      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].avgR).toBeGreaterThanOrEqual(result[i].avgR);
      }
    });
    
    it('should require minimum trade count', () => {
      const result = findOptimalCombinations(trades, filterOutcomes, 3);
      
      result.forEach(r => {
        expect(r.tradeCount).toBeGreaterThanOrEqual(3);
      });
    });
    
    it('should limit results to topN', () => {
      const result = findOptimalCombinations(trades, filterOutcomes, 1);
      
      expect(result.length).toBeLessThanOrEqual(1);
    });
  });
  
  describe('generateFilterOutcomes', () => {
    const trades: TradeData[] = [
      { id: '1', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.12, stopLoss: 1.09, takeProfit: 1.12, pnl: 100, rMultiple: 1, entryTime: new Date('2026-04-01T10:00:00Z'), exitTime: new Date('2026-04-01T11:00:00Z'), initialStopLoss: 1.09 },
      { id: '2', symbol: 'GBPUSD', direction: 'SHORT', entryPrice: 1.25, exitPrice: 1.24, stopLoss: 1.24, takeProfit: 1.27, pnl: -100, rMultiple: -1, entryTime: new Date('2026-04-01T14:00:00Z'), exitTime: new Date('2026-04-01T15:00:00Z'), initialStopLoss: 1.24 },
    ];
    
    it('should generate filter outcomes for each trade', () => {
      const result = generateFilterOutcomes(trades);
      
      expect(result.length).toBe(trades.length);
    });
    
    it('should include session filter', () => {
      const result = generateFilterOutcomes(trades);
      
      const sessions = result.map(outcomes => 
        outcomes.find(o => o.filterName === 'session')?.filterValue
      );
      
      expect(sessions.every(s => s !== undefined)).toBe(true);
    });
    
    it('should include dayOfWeek filter', () => {
      const result = generateFilterOutcomes(trades);
      
      const days = result.map(outcomes => 
        outcomes.find(o => o.filterName === 'dayOfWeek')?.filterValue
      );
      
      expect(days.every(d => d !== undefined)).toBe(true);
    });
    
    it('should include direction filter', () => {
      const result = generateFilterOutcomes(trades);
      
      const directions = result.map(outcomes => 
        outcomes.find(o => o.filterName === 'direction')?.filterValue
      );
      
      expect(directions).toContain('LONG');
      expect(directions).toContain('SHORT');
    });
    
    it('should include symbol filter', () => {
      const result = generateFilterOutcomes(trades);
      
      const symbols = result.map(outcomes => 
        outcomes.find(o => o.filterName === 'symbol')?.filterValue
      );
      
      expect(symbols).toContain('EURUSD');
      expect(symbols).toContain('GBPUSD');
    });
    
    it('should include rBucket filter', () => {
      const result = generateFilterOutcomes(trades);
      
      const buckets = result.map(outcomes => 
        outcomes.find(o => o.filterName === 'rBucket')?.filterValue
      );
      
      expect(buckets).toContain('WIN');
      expect(buckets).toContain('LOSS');
    });
    
    it('should correctly identify win/loss', () => {
      const result = generateFilterOutcomes(trades);
      
      const winOutcomes = result.map(outcomes => 
        outcomes.find(o => o.filterName === 'rBucket')
      );
      
      expect(winOutcomes[0]?.win).toBe(true);  // Trade 1: +100
      expect(winOutcomes[1]?.win).toBe(false); // Trade 2: -100
    });
  });
});