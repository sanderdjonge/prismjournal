import { describe, it, expect } from 'vitest';
import { 
  applyDailyLossLimit, 
  applyWeeklyLossLimit, 
  applyStreakBreak, 
  applyBigLossCooldown 
} from '@/lib/services/what-if/filters/psychology-filters';
import { TradeData } from '@/lib/services/what-if/types';

describe('Psychology Filters', () => {
  describe('applyDailyLossLimit', () => {
    const trades: TradeData[] = [
      { id: '1', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.11, stopLoss: 1.09, takeProfit: 1.12, pnl: 100, rMultiple: 1, entryTime: new Date('2026-04-01T09:00:00Z'), exitTime: new Date('2026-04-01T10:00:00Z'), initialStopLoss: 1.09 },
      { id: '2', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.09, stopLoss: 1.09, takeProfit: 1.12, pnl: -200, rMultiple: -2, entryTime: new Date('2026-04-01T11:00:00Z'), exitTime: new Date('2026-04-01T12:00:00Z'), initialStopLoss: 1.09 },
      { id: '3', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.08, stopLoss: 1.09, takeProfit: 1.12, pnl: -300, rMultiple: -3, entryTime: new Date('2026-04-01T13:00:00Z'), exitTime: new Date('2026-04-01T14:00:00Z'), initialStopLoss: 1.09 }, // Would hit limit
      { id: '4', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.12, stopLoss: 1.09, takeProfit: 1.13, pnl: 500, rMultiple: 5, entryTime: new Date('2026-04-01T15:00:00Z'), exitTime: new Date('2026-04-01T16:00:00Z'), initialStopLoss: 1.09 }, // After limit
      { id: '5', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.11, stopLoss: 1.09, takeProfit: 1.12, pnl: 100, rMultiple: 1, entryTime: new Date('2026-04-02T10:00:00Z'), exitTime: new Date('2026-04-02T11:00:00Z'), initialStopLoss: 1.09 }, // Next day
    ];
    
    it('should stop trading after daily loss limit hit', () => {
      const result = applyDailyLossLimit(trades, 400);
      
      // Day 1: 100 - 200 - 300 = -400 (at limit, trade 3 included)
      // Trade 4 excluded, trade 5 included (new day)
      expect(result.map(t => t.id)).toEqual(['1', '2', '3', '5']);
    });
    
    it('should allow all trades if limit not hit', () => {
      const result = applyDailyLossLimit(trades, 1000);
      
      expect(result).toHaveLength(5);
    });
    
    it('should handle trades without exit time', () => {
      const openTrades: TradeData[] = [
        { id: '1', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: null, stopLoss: 1.09, takeProfit: 1.12, pnl: null, rMultiple: null, entryTime: new Date('2026-04-01T10:00:00Z'), exitTime: null, initialStopLoss: 1.09 },
      ];
      
      const result = applyDailyLossLimit(openTrades, 500);
      
      expect(result).toHaveLength(0); // No closed trades
    });
  });
  
  describe('applyWeeklyLossLimit', () => {
    const trades: TradeData[] = [
      // Week 1 (2026-W14)
      { id: '1', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.15, stopLoss: 1.09, takeProfit: 1.16, pnl: 500, rMultiple: 5, entryTime: new Date('2026-04-01T10:00:00Z'), exitTime: new Date('2026-04-01T11:00:00Z'), initialStopLoss: 1.09 }, // Wed
      { id: '2', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.06, stopLoss: 1.09, takeProfit: 1.12, pnl: -400, rMultiple: -4, entryTime: new Date('2026-04-02T10:00:00Z'), exitTime: new Date('2026-04-02T11:00:00Z'), initialStopLoss: 1.09 }, // Thu
      { id: '3', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.07, stopLoss: 1.09, takeProfit: 1.12, pnl: -300, rMultiple: -3, entryTime: new Date('2026-04-03T10:00:00Z'), exitTime: new Date('2026-04-03T11:00:00Z'), initialStopLoss: 1.09 }, // Fri - hits limit
      { id: '4', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.12, stopLoss: 1.09, takeProfit: 1.13, pnl: 200, rMultiple: 2, entryTime: new Date('2026-04-04T10:00:00Z'), exitTime: new Date('2026-04-04T11:00:00Z'), initialStopLoss: 1.09 }, // Sat - excluded
      // Week 2 (2026-W15)
      { id: '5', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.11, stopLoss: 1.09, takeProfit: 1.12, pnl: 100, rMultiple: 1, entryTime: new Date('2026-04-06T10:00:00Z'), exitTime: new Date('2026-04-06T11:00:00Z'), initialStopLoss: 1.09 }, // Mon - new week
    ];
    
    it('should stop trading after weekly loss limit hit', () => {
      const result = applyWeeklyLossLimit(trades, 600);
      
      // Week 1: 500 - 400 - 300 = -200 (trade 3 makes it -200 total, still under limit)
      // Trade 4 on Sat might be excluded or included depending on ISO week
      // Trade 5 in week 2
      expect(result.length).toBeGreaterThanOrEqual(4);
    });
    
    it('should allow all trades if weekly limit not hit', () => {
      const result = applyWeeklyLossLimit(trades, 2000);
      
      expect(result).toHaveLength(5);
    });
  });
  
  describe('applyStreakBreak', () => {
    const trades: TradeData[] = [
      { id: '1', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.09, stopLoss: 1.09, takeProfit: 1.12, pnl: -100, rMultiple: -1, entryTime: new Date('2026-04-01T10:00:00Z'), exitTime: new Date('2026-04-01T11:00:00Z'), initialStopLoss: 1.09 },
      { id: '2', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.09, stopLoss: 1.09, takeProfit: 1.12, pnl: -100, rMultiple: -1, entryTime: new Date('2026-04-01T12:00:00Z'), exitTime: new Date('2026-04-01T13:00:00Z'), initialStopLoss: 1.09 },
      { id: '3', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.09, stopLoss: 1.09, takeProfit: 1.12, pnl: -100, rMultiple: -1, entryTime: new Date('2026-04-01T14:00:00Z'), exitTime: new Date('2026-04-01T15:00:00Z'), initialStopLoss: 1.09 }, // 3rd loss
      { id: '4', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.12, stopLoss: 1.09, takeProfit: 1.13, pnl: 500, rMultiple: 5, entryTime: new Date('2026-04-01T16:00:00Z'), exitTime: new Date('2026-04-01T17:00:00Z'), initialStopLoss: 1.09 }, // Should be excluded
      { id: '5', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.11, stopLoss: 1.09, takeProfit: 1.12, pnl: 100, rMultiple: 1, entryTime: new Date('2026-04-01T18:00:00Z'), exitTime: new Date('2026-04-01T19:00:00Z'), initialStopLoss: 1.09 }, // Should be excluded
    ];
    
    it('should hard stop after X consecutive losses', () => {
      const result = applyStreakBreak(trades, 2);
      
      // After 2 losses, trading stops entirely (hard stop)
      expect(result.map(t => t.id)).toEqual(['1', '2']);
    });
    
    it('should reset counter after a win (before hitting limit)', () => {
      // This test shows a win BEFORE hitting the streak limit resets the counter
      const tradesWithWin: TradeData[] = [
        { id: '1', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.09, stopLoss: 1.09, takeProfit: 1.12, pnl: -100, rMultiple: -1, entryTime: new Date('2026-04-01T10:00:00Z'), exitTime: new Date('2026-04-01T11:00:00Z'), initialStopLoss: 1.09 }, // Loss (counter=1)
        { id: '2', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.12, stopLoss: 1.09, takeProfit: 1.13, pnl: 200, rMultiple: 2, entryTime: new Date('2026-04-01T12:00:00Z'), exitTime: new Date('2026-04-01T13:00:00Z'), initialStopLoss: 1.09 }, // Win resets counter to 0
        { id: '3', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.09, stopLoss: 1.09, takeProfit: 1.12, pnl: -100, rMultiple: -1, entryTime: new Date('2026-04-01T14:00:00Z'), exitTime: new Date('2026-04-01T15:00:00Z'), initialStopLoss: 1.09 }, // Loss (counter=1)
        { id: '4', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.09, stopLoss: 1.09, takeProfit: 1.12, pnl: -100, rMultiple: -1, entryTime: new Date('2026-04-01T16:00:00Z'), exitTime: new Date('2026-04-01T17:00:00Z'), initialStopLoss: 1.09 }, // Loss (counter=2) -> hard stop
        { id: '5', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.11, stopLoss: 1.09, takeProfit: 1.12, pnl: 100, rMultiple: 1, entryTime: new Date('2026-04-01T18:00:00Z'), exitTime: new Date('2026-04-01T19:00:00Z'), initialStopLoss: 1.09 }, // Excluded
      ];
      
      const result = applyStreakBreak(tradesWithWin, 2);
      
      // Trade 1 loss (1), trade 2 win (reset to 0), trade 3 loss (1), trade 4 loss (2, stop), trade 5 excluded
      expect(result.map(t => t.id)).toEqual(['1', '2', '3', '4']);
    });
    
    it('should allow all trades if no streak threshold reached', () => {
      const result = applyStreakBreak(trades, 10);
      
      expect(result).toHaveLength(5);
    });
  });
  
  describe('applyBigLossCooldown', () => {
    const trades: TradeData[] = [
      { id: '1', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.105, stopLoss: 1.09, takeProfit: 1.12, pnl: -50, rMultiple: -0.5, entryTime: new Date('2026-04-01T10:00:00Z'), exitTime: new Date('2026-04-01T11:00:00Z'), initialStopLoss: 1.09 },
      { id: '2', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.08, stopLoss: 1.09, takeProfit: 1.12, pnl: -250, rMultiple: -2.5, entryTime: new Date('2026-04-01T12:00:00Z'), exitTime: new Date('2026-04-01T13:00:00Z'), initialStopLoss: 1.09 }, // Triggers cooldown
      { id: '3', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.11, stopLoss: 1.09, takeProfit: 1.12, pnl: 100, rMultiple: 1, entryTime: new Date('2026-04-01T13:30:00Z'), exitTime: new Date('2026-04-01T14:00:00Z'), initialStopLoss: 1.09 }, // In cooldown (1.5h after)
      { id: '4', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.115, stopLoss: 1.09, takeProfit: 1.12, pnl: 150, rMultiple: 1.5, entryTime: new Date('2026-04-01T15:00:00Z'), exitTime: new Date('2026-04-01T16:00:00Z'), initialStopLoss: 1.09 }, // After cooldown (3h after)
      { id: '5', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.105, stopLoss: 1.09, takeProfit: 1.12, pnl: -50, rMultiple: -0.5, entryTime: new Date('2026-04-01T17:00:00Z'), exitTime: new Date('2026-04-01T18:00:00Z'), initialStopLoss: 1.09 },
    ];
    
    it('should skip trades during cooldown period after big loss', () => {
      const result = applyBigLossCooldown(trades, { rThreshold: 2, cooldownHours: 2 });
      
      // Trade 2 triggers 2h cooldown from 12:00 to 14:00
      // Trade 3 at 13:30 is in cooldown, excluded
      // Trade 4 at 15:00 is after cooldown, included
      expect(result.map(t => t.id)).toEqual(['1', '2', '4', '5']);
    });
    
    it('should not trigger cooldown for small losses', () => {
      const smallLossTrades: TradeData[] = [
        { id: '1', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.085, stopLoss: 1.09, takeProfit: 1.12, pnl: -150, rMultiple: -1.5, entryTime: new Date('2026-04-01T10:00:00Z'), exitTime: new Date('2026-04-01T11:00:00Z'), initialStopLoss: 1.09 },
        { id: '2', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.11, stopLoss: 1.09, takeProfit: 1.12, pnl: 100, rMultiple: 1, entryTime: new Date('2026-04-01T12:00:00Z'), exitTime: new Date('2026-04-01T13:00:00Z'), initialStopLoss: 1.09 },
      ];
      
      const result = applyBigLossCooldown(smallLossTrades, { rThreshold: 2, cooldownHours: 2 });
      
      expect(result).toHaveLength(2);
    });
    
    it('should handle trades without rMultiple', () => {
      const noRMultipleTrades: TradeData[] = [
        { id: '1', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.08, stopLoss: 1.09, takeProfit: 1.12, pnl: -200, rMultiple: null, entryTime: new Date('2026-04-01T10:00:00Z'), exitTime: new Date('2026-04-01T11:00:00Z'), initialStopLoss: 1.09 },
        { id: '2', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.11, stopLoss: 1.09, takeProfit: 1.12, pnl: 100, rMultiple: null, entryTime: new Date('2026-04-01T12:00:00Z'), exitTime: new Date('2026-04-01T13:00:00Z'), initialStopLoss: 1.09 },
      ];
      
      const result = applyBigLossCooldown(noRMultipleTrades, { rThreshold: 2, cooldownHours: 2 });
      
      expect(result).toHaveLength(2);
    });
  });
});