import { describe, it, expect, vi } from 'vitest';
import { 
  applyVolatilityFilterSync,
  applyVolatilityFilter,
  applyNewsEventFilterSync,
  applyNewsEventFilter,
  VolatilityData,
  NewsEvent
} from '@/lib/services/what-if/filters/market-filters';
import { TradeData } from '@/lib/services/what-if/types';

describe('Market Filters', () => {
  describe('applyVolatilityFilterSync', () => {
    const trades: TradeData[] = [
      { id: '1', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.12, stopLoss: 1.09, takeProfit: 1.12, pnl: 100, rMultiple: 1, entryTime: new Date('2026-04-01T10:00:00Z'), exitTime: new Date('2026-04-01T11:00:00Z'), initialStopLoss: 1.09 },
      { id: '2', symbol: 'GBPUSD', direction: 'LONG', entryPrice: 1.25, exitPrice: 1.24, stopLoss: 1.24, takeProfit: 1.27, pnl: -100, rMultiple: -1, entryTime: new Date('2026-04-01T12:00:00Z'), exitTime: new Date('2026-04-01T13:00:00Z'), initialStopLoss: 1.24 },
      { id: '3', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.11, stopLoss: 1.09, takeProfit: 1.11, pnl: 50, rMultiple: 0.5, entryTime: new Date('2026-04-02T10:00:00Z'), exitTime: new Date('2026-04-02T11:00:00Z'), initialStopLoss: 1.09 },
    ];
    
    // Build volatility data with correct date keys
    const volData = new Map<string, VolatilityData>();
    // Trade 1: 2026-04-01
    volData.set(`EURUSD-${new Date('2026-04-01T10:00:00Z').toDateString()}`, {
      symbol: 'EURUSD', atr: 75, atrPercent: 0.68, timestamp: new Date('2026-04-01')
    });
    // Trade 2: 2026-04-01
    volData.set(`GBPUSD-${new Date('2026-04-01T12:00:00Z').toDateString()}`, {
      symbol: 'GBPUSD', atr: 120, atrPercent: 0.96, timestamp: new Date('2026-04-01')
    });
    // Trade 3: 2026-04-02
    volData.set(`EURUSD-${new Date('2026-04-02T10:00:00Z').toDateString()}`, {
      symbol: 'EURUSD', atr: 40, atrPercent: 0.36, timestamp: new Date('2026-04-02')
    });
    
    const volatilityData = volData;
    
    it('should filter trades with high volatility when avoiding', () => {
      const result = applyVolatilityFilterSync(trades, {
        mode: 'avoid',
        atrPercentThreshold: 0.5
      }, volatilityData);
      
      // Trade 1: EURUSD 0.68% > 0.5%, should be filtered
      // Trade 2: GBPUSD 0.96% > 0.5%, should be filtered  
      // Trade 3: No matching data, included (fail open)
      expect(result.map(t => t.id)).toEqual(['3']);
    });
    
    it('should filter trades with low volatility when preferring', () => {
      const result = applyVolatilityFilterSync(trades, {
        mode: 'prefer',
        atrPercentThreshold: 0.5
      }, volatilityData);
      
      // Trade 1: EURUSD 0.68% > 0.5%, included
      // Trade 2: GBPUSD 0.96% > 0.5%, included
      // Trade 3: EURUSD 0.36% < 0.5%, filtered (low vol)
      expect(result.map(t => t.id)).toEqual(['1', '2']);
    });
    
    it('should use ATR threshold when specified', () => {
      const result = applyVolatilityFilterSync(trades, {
        mode: 'avoid',
        atrThreshold: 100
      }, volatilityData);
      
      // Trade 1: EURUSD ATR 75 < 100, included
      // Trade 2: GBPUSD ATR 120 > 100, filtered
      // Trade 3: No matching data, included
      expect(result.map(t => t.id)).toEqual(['1', '3']);
    });
    
    it('should include all trades if no volatility data', () => {
      const result = applyVolatilityFilterSync(trades, {
        mode: 'avoid',
        atrPercentThreshold: 0.5
      }, new Map());
      
      expect(result).toHaveLength(3);
    });
    
    it('should handle missing volatility data gracefully', () => {
      const result = applyVolatilityFilterSync(trades, {
        mode: 'avoid',
        atrPercentThreshold: 0.5
      }, new Map()); // Empty map = no data
      
      // All trades included when no volatility data available
      expect(result).toHaveLength(3);
    });
  });
  
  describe('applyVolatilityFilter (async)', () => {
    const trades: TradeData[] = [
      { id: '1', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.12, stopLoss: 1.09, takeProfit: 1.12, pnl: 100, rMultiple: 1, entryTime: new Date('2026-04-01T10:00:00Z'), exitTime: new Date('2026-04-01T11:00:00Z'), initialStopLoss: 1.09 },
    ];
    
    it('should return all trades if no provider configured', async () => {
      const result = await applyVolatilityFilter(trades, {
        mode: 'avoid',
        atrPercentThreshold: 0.5
      });
      
      expect(result).toHaveLength(1);
    });
    
    it('should use provider to fetch volatility data', async () => {
      const mockProvider = vi.fn().mockResolvedValue({
        symbol: 'EURUSD',
        atr: 75,
        atrPercent: 0.68,
        timestamp: new Date()
      });
      
      const result = await applyVolatilityFilter(trades, {
        mode: 'avoid',
        atrPercentThreshold: 0.5
      }, mockProvider);
      
      expect(mockProvider).toHaveBeenCalledWith('EURUSD', expect.any(Date));
      expect(result).toHaveLength(0); // Filtered due to high vol
    });
    
    it('should handle provider errors gracefully', async () => {
      const mockProvider = vi.fn().mockRejectedValue(new Error('API error'));
      
      const result = await applyVolatilityFilter(trades, {
        mode: 'avoid',
        atrPercentThreshold: 0.5
      }, mockProvider);
      
      expect(result).toHaveLength(1); // Fail open
    });
    
    it('should include trade if provider returns null', async () => {
      const mockProvider = vi.fn().mockResolvedValue(null);
      
      const result = await applyVolatilityFilter(trades, {
        mode: 'avoid',
        atrPercentThreshold: 0.5
      }, mockProvider);
      
      expect(result).toHaveLength(1);
    });
  });
  
  describe('applyNewsEventFilterSync', () => {
    const trades: TradeData[] = [
      { id: '1', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.12, stopLoss: 1.09, takeProfit: 1.12, pnl: 100, rMultiple: 1, entryTime: new Date('2026-04-01T09:00:00Z'), exitTime: new Date('2026-04-01T10:00:00Z'), initialStopLoss: 1.09 }, // Before news
      { id: '2', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.09, stopLoss: 1.09, takeProfit: 1.12, pnl: -100, rMultiple: -1, entryTime: new Date('2026-04-01T13:55:00Z'), exitTime: new Date('2026-04-01T15:00:00Z'), initialStopLoss: 1.09 }, // During news window
      { id: '3', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.11, stopLoss: 1.09, takeProfit: 1.11, pnl: 50, rMultiple: 0.5, entryTime: new Date('2026-04-01T16:00:00Z'), exitTime: new Date('2026-04-01T17:00:00Z'), initialStopLoss: 1.09 }, // After news
    ];
    
    const newsEvents: NewsEvent[] = [
      {
        id: '1',
        title: 'Non-Farm Payrolls',
        currency: 'USD',
        impact: 'high',
        datetime: new Date('2026-04-01T14:00:00Z'),
        forecast: '200K',
        previous: '180K'
      },
      {
        id: '2',
        title: 'ISM Manufacturing PMI',
        currency: 'USD',
        impact: 'medium',
        datetime: new Date('2026-04-01T15:00:00Z')
      }
    ];
    
    it('should filter trades around high-impact news', () => {
      const result = applyNewsEventFilterSync(trades, {
        avoidHighImpact: true,
        avoidMediumImpact: false,
        windowMinutes: 30
      }, newsEvents);
      
      // Trade 1: 9:00 AM, before news at 14:00, included
      // Trade 2: 13:55, within 30 min of 14:00 news, filtered
      // Trade 3: 16:00, after news window, included
      expect(result.map(t => t.id)).toEqual(['1', '3']);
    });
    
    it('should filter trades around medium-impact news', () => {
      const result = applyNewsEventFilterSync(trades, {
        avoidHighImpact: false,
        avoidMediumImpact: true,
        windowMinutes: 30
      }, newsEvents);
      
      // Trade 1: 9:00 AM, before all news, included
      // Trade 2: 13:55, outside medium impact window (15:00 ± 30min), included
      // Trade 3: 16:00, 1 hour after 15:00 news, outside 30 min window, included
      expect(result.map(t => t.id)).toEqual(['1', '2', '3']);
    });
    
    it('should filter both high and medium impact when both enabled', () => {
      const result = applyNewsEventFilterSync(trades, {
        avoidHighImpact: true,
        avoidMediumImpact: true,
        windowMinutes: 30
      }, newsEvents);
      
      // Trade 1: 9:00, before all news windows
      // Trade 2: 13:55, within 30 min of high impact at 14:00, filtered
      // Trade 3: 16:00, outside all windows, included
      expect(result.map(t => t.id)).toEqual(['1', '3']);
    });
    
    it('should include all trades if no news events', () => {
      const result = applyNewsEventFilterSync(trades, {
        avoidHighImpact: true,
        avoidMediumImpact: true,
        windowMinutes: 30
      }, []);
      
      expect(result).toHaveLength(3);
    });
    
    it('should include all trades if no avoidance enabled', () => {
      const result = applyNewsEventFilterSync(trades, {
        avoidHighImpact: false,
        avoidMediumImpact: false,
        windowMinutes: 30
      }, newsEvents);
      
      expect(result).toHaveLength(3);
    });
    
    it('should handle custom window size', () => {
      const result = applyNewsEventFilterSync(trades, {
        avoidHighImpact: true,
        avoidMediumImpact: false,
        windowMinutes: 60 // 1 hour window
      }, newsEvents);
      
      // Trade 1: 9:00, 5 hours before 14:00, included
      // Trade 2: 13:55, within 1 hour of 14:00, filtered
      // Trade 3: 16:00, 2 hours after 14:00, included
      expect(result.map(t => t.id)).toEqual(['1', '3']);
    });
    
    it('should handle news events with different currencies', () => {
      const eurOnlyEvents: NewsEvent[] = [
        {
          id: '1',
          title: 'ECB Rate Decision',
          currency: 'EUR',
          impact: 'high',
          datetime: new Date('2026-04-01T14:00:00Z')
        }
      ];
      
      const result = applyNewsEventFilterSync(trades, {
        avoidHighImpact: true,
        avoidMediumImpact: false,
        windowMinutes: 30
      }, eurOnlyEvents);
      
      // EURUSD trade, EUR news - should be affected
      expect(result.map(t => t.id)).toEqual(['1', '3']);
    });
  });
  
  describe('applyNewsEventFilter (async)', () => {
    const trades: TradeData[] = [
      { id: '1', symbol: 'EURUSD', direction: 'LONG', entryPrice: 1.1, exitPrice: 1.12, stopLoss: 1.09, takeProfit: 1.12, pnl: 100, rMultiple: 1, entryTime: new Date('2026-04-01T09:00:00Z'), exitTime: new Date('2026-04-01T10:00:00Z'), initialStopLoss: 1.09 },
    ];
    
    it('should return all trades if no provider configured', async () => {
      const result = await applyNewsEventFilter(trades, {
        avoidHighImpact: true,
        avoidMediumImpact: true,
        windowMinutes: 30
      });
      
      expect(result).toHaveLength(1);
    });
    
    it('should fetch and use news events from provider', async () => {
      const mockProvider = vi.fn().mockResolvedValue([
        {
          id: '1',
          title: 'NFP',
          currency: 'USD',
          impact: 'high' as const,
          datetime: new Date('2026-04-01T09:30:00Z')
        }
      ]);
      
      const result = await applyNewsEventFilter(trades, {
        avoidHighImpact: true,
        avoidMediumImpact: false,
        windowMinutes: 30
      }, mockProvider);
      
      expect(mockProvider).toHaveBeenCalled();
      // Trade at 9:00, news at 9:30, within 30 min window, filtered
      expect(result).toHaveLength(0);
    });
    
    it('should extract currencies from trade symbols', async () => {
      const mockProvider = vi.fn().mockResolvedValue([]);
      
      await applyNewsEventFilter(trades, {
        avoidHighImpact: true,
        avoidMediumImpact: true,
        windowMinutes: 30
      }, mockProvider);
      
      const calledCurrencies = mockProvider.mock.calls[0][0];
      expect(calledCurrencies).toContain('EUR');
      expect(calledCurrencies).toContain('USD');
    });
    
    it('should handle provider errors gracefully', async () => {
      const mockProvider = vi.fn().mockRejectedValue(new Error('API error'));
      
      const result = await applyNewsEventFilter(trades, {
        avoidHighImpact: true,
        avoidMediumImpact: true,
        windowMinutes: 30
      }, mockProvider);
      
      expect(result).toHaveLength(1); // Fail open
    });
  });
});