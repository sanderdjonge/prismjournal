import { describe, it, expect } from 'vitest';
import { normalizeFilters, TimeFilters, RiskFilters, PsychologyFilters, MarketFilters } from '@/lib/services/what-if/types';

describe('What-If Types', () => {
  describe('normalizeFilters', () => {
    it('should map flat excludeDays to nested time.excludeDays', () => {
      const input = { excludeDays: [1, 5] };
      const result = normalizeFilters(input);
      
      expect(result.time?.excludeDays).toEqual([1, 5]);
    });
    
    it('should preserve existing nested filters', () => {
      const input = { 
        time: { maxDurationHours: 4 },
        excludeDays: [1] 
      };
      const result = normalizeFilters(input);
      
      expect(result.time?.maxDurationHours).toBe(4);
      expect(result.time?.excludeDays).toEqual([1]);
    });
    
    it('should prefer nested over flat when both exist', () => {
      const input = { 
        excludeDays: [1],
        time: { excludeDays: [5] }
      };
      const result = normalizeFilters(input);
      
      expect(result.time?.excludeDays).toEqual([5]);
    });
    
    it('should map flat excludeHours to nested time.excludeHours', () => {
      const input = { excludeHours: [9, 10] };
      const result = normalizeFilters(input);
      
      expect(result.time?.excludeHours).toEqual([9, 10]);
    });
    
    it('should map flat stopLossMultiplier to nested risk.stopLossMultiplier', () => {
      const input = { stopLossMultiplier: 1.5 };
      const result = normalizeFilters(input);
      
      expect(result.risk?.stopLossMultiplier).toBe(1.5);
    });
    
    it('should return empty objects for undefined filters', () => {
      const input = {};
      const result = normalizeFilters(input);
      
      expect(result.time).toBeDefined();
      expect(result.risk).toBeDefined();
    });
  });
  
  describe('TimeFilters interface', () => {
    it('should accept valid marketSession values', () => {
      const filters: TimeFilters = {
        marketSession: ['LONDON', 'NEW_YORK', 'ASIA', 'OVERLAP_LN', 'OVERLAP_NA'],
        excludeDays: [0, 6],
        excludeHours: [9, 10],
        maxDurationHours: 4,
        minDurationHours: 0.5,
      };
      
      expect(filters.marketSession).toHaveLength(5);
      expect(filters.maxDurationHours).toBe(4);
    });
  });
  
  describe('RiskFilters interface', () => {
    it('should accept valid risk filter values', () => {
      const filters: RiskFilters = {
        stopLossMultiplier: 1.5,
        maeMultiplier: 1.2,
        mfeMultiplier: 0.5,
        breakevenTrigger: 1,
        positionSizeMethod: 'FIXED_R',
        riskPerTrade: 100,
        trailingPercent: 50,
        partialExitAt: { rLevel: 2, percent: 50 },  // Fixed: was percentClose
      };
      
      expect(filters.positionSizeMethod).toBe('FIXED_R');
      expect(filters.partialExitAt?.rLevel).toBe(2);
    });
  });
  
  describe('PsychologyFilters interface', () => {
    it('should accept valid psychology filter values', () => {
      const filters: PsychologyFilters = {
        dailyLossLimit: 500,
        weeklyLossLimit: 1500,
        stopAfterLosses: 3,
        avoidAfterBigLoss: { rThreshold: 2, cooldownHours: 2 },
      };
      
      expect(filters.dailyLossLimit).toBe(500);
      expect(filters.avoidAfterBigLoss?.rThreshold).toBe(2);
    });
  });
  
  describe('MarketFilters interface', () => {
    it('should accept valid market filter values', () => {
      const filters: MarketFilters = {
        minVolatility: 0.5,
        maxVolatility: 2.0,
        avoidNewsEvents: true,
        newsBufferMinutes: 30,
      };
      
      expect(filters.avoidNewsEvents).toBe(true);
      expect(filters.newsBufferMinutes).toBe(30);
    });
  });
});