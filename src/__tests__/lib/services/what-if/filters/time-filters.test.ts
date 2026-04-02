import { describe, it, expect } from 'vitest';
import { 
  applyDurationFilter, 
  applyMarketSessionFilter, 
  applyDayFilter, 
  applyHourFilter 
} from '@/lib/services/what-if/filters/time-filters';
import { TradeData } from '@/lib/services/what-if/types';

describe('Time Filters', () => {
  describe('applyDurationFilter', () => {
    const trades: TradeData[] = [
      { id: '1', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.11, stopLoss: 1.09, takeProfit: 1.12, pnl: 100, rMultiple: 1, entryTime: new Date('2026-04-01T10:00:00Z'), exitTime: new Date('2026-04-01T11:00:00Z'), initialStopLoss: 1.09 }, // 1h
      { id: '2', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.14, stopLoss: 1.09, takeProfit: 1.15, pnl: 400, rMultiple: 4, entryTime: new Date('2026-04-01T10:00:00Z'), exitTime: new Date('2026-04-01T14:00:00Z'), initialStopLoss: 1.09 }, // 4h
      { id: '3', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.18, stopLoss: 1.09, takeProfit: 1.2, pnl: 800, rMultiple: 8, entryTime: new Date('2026-04-01T10:00:00Z'), exitTime: new Date('2026-04-01T18:00:00Z'), initialStopLoss: 1.09 }, // 8h
      { id: '4', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: null, stopLoss: 1.09, takeProfit: 1.12, pnl: null, rMultiple: null, entryTime: new Date('2026-04-01T10:00:00Z'), exitTime: null, initialStopLoss: 1.09 }, // open trade
    ];
    
    it('should exclude trades longer than maxHours', () => {
      const result = applyDurationFilter(trades, { maxHours: 3 });
      
      expect(result).toHaveLength(2);
      expect(result.map(t => t.id)).toEqual(['1', '4']); // 1h and open trade
    });
    
    it('should exclude trades shorter than minHours', () => {
      const result = applyDurationFilter(trades, { minHours: 5 });
      
      expect(result).toHaveLength(2);
      expect(result.map(t => t.id)).toEqual(['3', '4']); // 8h and open trade
    });
    
    it('should apply both min and max hours', () => {
      const result = applyDurationFilter(trades, { minHours: 2, maxHours: 6 });
      
      expect(result).toHaveLength(2);
      expect(result.map(t => t.id)).toEqual(['2', '4']); // 4h and open trade
    });
    
    it('should return all trades when no params specified', () => {
      const result = applyDurationFilter(trades, {});
      
      expect(result).toHaveLength(4);
    });
    
    it('should handle empty trades array', () => {
      const result = applyDurationFilter([], { maxHours: 2 });
      
      expect(result).toHaveLength(0);
    });
  });
  
  describe('applyMarketSessionFilter', () => {
    const trades: TradeData[] = [
      { id: '1', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.11, stopLoss: 1.09, takeProfit: 1.12, pnl: 100, rMultiple: 1, entryTime: new Date('2026-04-01T09:00:00Z'), exitTime: new Date('2026-04-01T10:00:00Z'), initialStopLoss: 1.09 }, // 9 UTC = London open
      { id: '2', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.11, stopLoss: 1.09, takeProfit: 1.12, pnl: 100, rMultiple: 1, entryTime: new Date('2026-04-01T14:00:00Z'), exitTime: new Date('2026-04-01T15:00:00Z'), initialStopLoss: 1.09 }, // 14 UTC = NY open, London/NY overlap
      { id: '3', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.11, stopLoss: 1.09, takeProfit: 1.12, pnl: 100, rMultiple: 1, entryTime: new Date('2026-04-01T00:00:00Z'), exitTime: new Date('2026-04-01T01:00:00Z'), initialStopLoss: 1.09 }, // 0 UTC = Asia session
      { id: '4', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.11, stopLoss: 1.09, takeProfit: 1.12, pnl: 100, rMultiple: 1, entryTime: new Date('2026-04-01T20:00:00Z'), exitTime: new Date('2026-04-01T21:00:00Z'), initialStopLoss: 1.09 }, // 20 UTC = NY afternoon
    ];
    
    it('should filter to London session only', () => {
      const result = applyMarketSessionFilter(trades, ['LONDON']);
      
      expect(result).toHaveLength(2);
      expect(result.map(t => t.id)).toEqual(['1', '2']); // 9 and 14 UTC
    });
    
    it('should filter to NY session only', () => {
      const result = applyMarketSessionFilter(trades, ['NEW_YORK']);
      
      expect(result).toHaveLength(2);
      expect(result.map(t => t.id)).toEqual(['2', '4']); // 14 and 20 UTC
    });
    
    it('should filter to London/NY overlap only', () => {
      const result = applyMarketSessionFilter(trades, ['OVERLAP_LN']);
      
      expect(result).toHaveLength(1);
      expect(result.map(t => t.id)).toEqual(['2']); // 14 UTC only
    });
    
    it('should handle Asia overnight session', () => {
      const result = applyMarketSessionFilter(trades, ['ASIA']);
      
      expect(result).toHaveLength(1);
      expect(result.map(t => t.id)).toEqual(['3']); // 0 UTC
    });
    
    it('should include trades matching any of multiple sessions', () => {
      const result = applyMarketSessionFilter(trades, ['LONDON', 'ASIA']);
      
      expect(result).toHaveLength(3);
      expect(result.map(t => t.id)).toEqual(['1', '2', '3']);
    });
    
    it('should return all trades when no sessions specified', () => {
      const result = applyMarketSessionFilter(trades, []);
      
      expect(result).toHaveLength(4);
    });
  });
  
  describe('applyDayFilter', () => {
    const trades: TradeData[] = [
      { id: '1', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.11, stopLoss: 1.09, takeProfit: 1.12, pnl: 100, rMultiple: 1, entryTime: new Date('2026-04-06T10:00:00Z'), exitTime: new Date('2026-04-06T11:00:00Z'), initialStopLoss: 1.09 }, // Monday
      { id: '2', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.11, stopLoss: 1.09, takeProfit: 1.12, pnl: 100, rMultiple: 1, entryTime: new Date('2026-04-10T10:00:00Z'), exitTime: new Date('2026-04-10T11:00:00Z'), initialStopLoss: 1.09 }, // Friday
      { id: '3', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.11, stopLoss: 1.09, takeProfit: 1.12, pnl: 100, rMultiple: 1, entryTime: new Date('2026-04-08T10:00:00Z'), exitTime: new Date('2026-04-08T11:00:00Z'), initialStopLoss: 1.09 }, // Wednesday
    ];
    
    it('should exclude trades on specified days', () => {
      // Monday = 1, Friday = 5
      const result = applyDayFilter(trades, [1, 5]);
      
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('3'); // Wednesday only
    });
    
    it('should return all trades when no days excluded', () => {
      const result = applyDayFilter(trades, []);
      
      expect(result).toHaveLength(3);
    });
  });
  
  describe('applyHourFilter', () => {
    const trades: TradeData[] = [
      { id: '1', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.11, stopLoss: 1.09, takeProfit: 1.12, pnl: 100, rMultiple: 1, entryTime: new Date('2026-04-06T09:00:00Z'), exitTime: new Date('2026-04-06T10:00:00Z'), initialStopLoss: 1.09 }, // 9h
      { id: '2', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.11, stopLoss: 1.09, takeProfit: 1.12, pnl: 100, rMultiple: 1, entryTime: new Date('2026-04-06T14:00:00Z'), exitTime: new Date('2026-04-06T15:00:00Z'), initialStopLoss: 1.09 }, // 14h
      { id: '3', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.11, stopLoss: 1.09, takeProfit: 1.12, pnl: 100, rMultiple: 1, entryTime: new Date('2026-04-06T16:00:00Z'), exitTime: new Date('2026-04-06T17:00:00Z'), initialStopLoss: 1.09 }, // 16h
    ];
    
    it('should exclude trades during specified hours', () => {
      const result = applyHourFilter(trades, [9, 14]);
      
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('3'); // 16h only
    });
    
    it('should return all trades when no hours excluded', () => {
      const result = applyHourFilter(trades, []);
      
      expect(result).toHaveLength(3);
    });
  });
});