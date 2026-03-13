import { describe, it, expect } from 'vitest';
import {
  calculateProfitFactor,
  calculateExpectancy,
  calculateTiltmeterScore,
  calculateEdgeStability,
} from '../../../server/utils/analytics_compute';

interface TradeData {
  pnl: number;
  rMultiple?: number;
  entryRating?: number;
  exitRating?: number;
  managementRating?: number;
}

describe('Analytics Compute Functions', () => {
  describe('calculateProfitFactor', () => {
    it('calculates profit factor correctly with profits and losses', () => {
      const trades: TradeData[] = [
        { pnl: 100 },
        { pnl: 200 },
        { pnl: -50 },
        { pnl: -50 },
      ];
      expect(calculateProfitFactor(trades)).toBe(3); // 300 / 100 = 3
    });

    it('returns total profits when no losses', () => {
      const trades: TradeData[] = [
        { pnl: 100 },
        { pnl: 200 },
        { pnl: 50 },
      ];
      expect(calculateProfitFactor(trades)).toBe(350); // Sum of all profits
    });

    it('returns 0 when no trades', () => {
      const trades: TradeData[] = [];
      expect(calculateProfitFactor(trades)).toBe(0);
    });

    it('returns 0 when only losses', () => {
      const trades: TradeData[] = [
        { pnl: -100 },
        { pnl: -200 },
      ];
      expect(calculateProfitFactor(trades)).toBe(0);
    });

    it('handles break-even trades (pnl = 0)', () => {
      const trades: TradeData[] = [
        { pnl: 100 },
        { pnl: 0 },
        { pnl: -50 },
      ];
      expect(calculateProfitFactor(trades)).toBe(2); // 100 / 50 = 2
    });

    it('calculates profit factor with decimal precision', () => {
      const trades: TradeData[] = [
        { pnl: 100 },
        { pnl: -75 },
      ];
      expect(calculateProfitFactor(trades)).toBe(1.33); // 100 / 75 = 1.33...
    });

    it('handles large numbers correctly', () => {
      const trades: TradeData[] = [
        { pnl: 100000 },
        { pnl: -50000 },
      ];
      expect(calculateProfitFactor(trades)).toBe(2);
    });
  });

  describe('calculateExpectancy', () => {
    it('calculates average R-multiple correctly', () => {
      const trades: TradeData[] = [
        { pnl: 100, rMultiple: 2 },
        { pnl: 50, rMultiple: 1 },
        { pnl: -25, rMultiple: -0.5 },
      ];
      expect(calculateExpectancy(trades)).toBeCloseTo(0.83, 1); // (2 + 1 - 0.5) / 3
    });

    it('returns 0 when no trades have rMultiple', () => {
      const trades: TradeData[] = [
        { pnl: 100 },
        { pnl: -50 },
      ];
      expect(calculateExpectancy(trades)).toBe(0);
    });

    it('returns 0 when no trades', () => {
      const trades: TradeData[] = [];
      expect(calculateExpectancy(trades)).toBe(0);
    });

    it('handles single trade with rMultiple', () => {
      const trades: TradeData[] = [
        { pnl: 100, rMultiple: 2.5 },
      ];
      expect(calculateExpectancy(trades)).toBe(2.5);
    });

    it('ignores trades without rMultiple', () => {
      const trades: TradeData[] = [
        { pnl: 100, rMultiple: 2 },
        { pnl: 50 }, // No rMultiple
        { pnl: -25, rMultiple: -0.5 },
      ];
      expect(calculateExpectancy(trades)).toBeCloseTo(0.75, 2); // (2 - 0.5) / 2
    });

    it('handles all positive R-multiples', () => {
      const trades: TradeData[] = [
        { pnl: 100, rMultiple: 1 },
        { pnl: 200, rMultiple: 2 },
        { pnl: 150, rMultiple: 1.5 },
      ];
      expect(calculateExpectancy(trades)).toBeCloseTo(1.5, 1);
    });

    it('handles all negative R-multiples', () => {
      const trades: TradeData[] = [
        { pnl: -100, rMultiple: -1 },
        { pnl: -200, rMultiple: -2 },
      ];
      expect(calculateExpectancy(trades)).toBe(-1.5);
    });
  });

  describe('calculateTiltmeterScore', () => {
    it('returns 100 when no trades', () => {
      const trades: TradeData[] = [];
      expect(calculateTiltmeterScore(trades)).toBe(100);
    });

    it('returns 100 when no ratings', () => {
      const trades: TradeData[] = [
        { pnl: 100 },
        { pnl: -50 },
      ];
      expect(calculateTiltmeterScore(trades)).toBe(100);
    });

    it('calculates score from entry rating only', () => {
      const trades: TradeData[] = [
        { pnl: 100, entryRating: 5 },
        { pnl: -50, entryRating: 3 },
      ];
      // Average: (5 + 3) / 2 = 4
      // Normalized: ((4 - 1) / 4) * 100 = 75
      expect(calculateTiltmeterScore(trades)).toBe(75);
    });

    it('calculates score from all rating types', () => {
      const trades: TradeData[] = [
        { pnl: 100, entryRating: 5, exitRating: 4, managementRating: 5 },
        { pnl: -50, entryRating: 3, exitRating: 3, managementRating: 4 },
      ];
      // Total: 5+4+5+3+3+4 = 24, Count: 6
      // Average: 4
      // Normalized: ((4 - 1) / 4) * 100 = 75
      expect(calculateTiltmeterScore(trades)).toBe(75);
    });

    it('returns 100 for perfect ratings (all 5s)', () => {
      const trades: TradeData[] = [
        { pnl: 100, entryRating: 5, exitRating: 5, managementRating: 5 },
        { pnl: 50, entryRating: 5, exitRating: 5, managementRating: 5 },
      ];
      // Average: 5
      // Normalized: ((5 - 1) / 4) * 100 = 100
      expect(calculateTiltmeterScore(trades)).toBe(100);
    });

    it('returns 0 for worst ratings (all 1s)', () => {
      const trades: TradeData[] = [
        { pnl: -100, entryRating: 1, exitRating: 1, managementRating: 1 },
        { pnl: -50, entryRating: 1, exitRating: 1, managementRating: 1 },
      ];
      // Average: 1
      // Normalized: ((1 - 1) / 4) * 100 = 0
      expect(calculateTiltmeterScore(trades)).toBe(0);
    });

    it('handles partial ratings (some trades have ratings, some do not)', () => {
      const trades: TradeData[] = [
        { pnl: 100, entryRating: 4 },
        { pnl: -50 }, // No ratings
        { pnl: 25, exitRating: 3 },
      ];
      // Total: 4 + 3 = 7, Count: 2
      // Average: 3.5
      // Normalized: ((3.5 - 1) / 4) * 100 = 62.5
      // Implementation rounds, so accept either 62 or 63
      const score = calculateTiltmeterScore(trades);
      expect(score).toBeGreaterThanOrEqual(62);
      expect(score).toBeLessThanOrEqual(63);
    });

    it('handles single trade with single rating', () => {
      const trades: TradeData[] = [
        { pnl: 100, entryRating: 3 },
      ];
      // Average: 3
      // Normalized: ((3 - 1) / 4) * 100 = 50
      expect(calculateTiltmeterScore(trades)).toBe(50);
    });
  });

  describe('calculateEdgeStability', () => {
    it('returns 100 when fewer than 2 trades with rMultiple', () => {
      const trades: TradeData[] = [
        { pnl: 100, rMultiple: 2 },
      ];
      expect(calculateEdgeStability(trades)).toBe(100);
    });

    it('returns 100 when no trades', () => {
      const trades: TradeData[] = [];
      expect(calculateEdgeStability(trades)).toBe(100);
    });

    it('returns 100 when no trades have rMultiple', () => {
      const trades: TradeData[] = [
        { pnl: 100 },
        { pnl: -50 },
      ];
      expect(calculateEdgeStability(trades)).toBe(100);
    });

    it('calculates stability with consistent R-multiples (low variance)', () => {
      const trades: TradeData[] = [
        { pnl: 100, rMultiple: 1 },
        { pnl: 100, rMultiple: 1 },
        { pnl: 100, rMultiple: 1 },
      ];
      // All same values = 0 std dev = 100 stability
      expect(calculateEdgeStability(trades)).toBe(100);
    });

    it('calculates lower stability with high variance R-multiples', () => {
      const trades: TradeData[] = [
        { pnl: 100, rMultiple: 5 },
        { pnl: -100, rMultiple: -2 },
      ];
      // High variance should result in lower stability
      const stability = calculateEdgeStability(trades);
      expect(stability).toBeLessThan(100);
      // Note: With very high variance, stability can be 0 or negative (clamped to 0)
      expect(stability).toBeGreaterThanOrEqual(0);
    });

    it('ignores trades without rMultiple', () => {
      const trades: TradeData[] = [
        { pnl: 100, rMultiple: 1 },
        { pnl: 50 }, // No rMultiple
        { pnl: 100, rMultiple: 1 },
      ];
      // Only 2 trades with rMultiple, both same value
      expect(calculateEdgeStability(trades)).toBe(100);
    });

    it('handles mixed positive and negative R-multiples', () => {
      const trades: TradeData[] = [
        { pnl: 100, rMultiple: 2 },
        { pnl: -50, rMultiple: -1 },
        { pnl: 75, rMultiple: 1.5 },
        { pnl: -25, rMultiple: -0.5 },
      ];
      const stability = calculateEdgeStability(trades);
      expect(stability).toBeGreaterThan(0);
      expect(stability).toBeLessThanOrEqual(100);
    });

    it('does not return negative stability', () => {
      const trades: TradeData[] = [
        { pnl: 1000, rMultiple: 10 },
        { pnl: -1000, rMultiple: -10 },
      ];
      // Very high variance
      const stability = calculateEdgeStability(trades);
      expect(stability).toBeGreaterThanOrEqual(0);
    });

    it('calculates stability correctly for typical trading scenario', () => {
      const trades: TradeData[] = [
        { pnl: 100, rMultiple: 1.2 },
        { pnl: 150, rMultiple: 1.5 },
        { pnl: -50, rMultiple: -0.5 },
        { pnl: 80, rMultiple: 0.8 },
        { pnl: -30, rMultiple: -0.3 },
      ];
      const stability = calculateEdgeStability(trades);
      // Should be a reasonable stability score
      expect(stability).toBeGreaterThan(50);
      expect(stability).toBeLessThan(100);
    });
  });

  describe('Integration: All analytics functions together', () => {
    it('provides meaningful metrics for a profitable trader', () => {
      const trades: TradeData[] = [
        { pnl: 200, rMultiple: 2, entryRating: 4, exitRating: 5, managementRating: 4 },
        { pnl: 150, rMultiple: 1.5, entryRating: 5, exitRating: 4, managementRating: 5 },
        { pnl: -50, rMultiple: -0.5, entryRating: 3, exitRating: 2, managementRating: 3 },
        { pnl: 100, rMultiple: 1, entryRating: 4, exitRating: 4, managementRating: 4 },
        { pnl: -30, rMultiple: -0.3, entryRating: 2, exitRating: 3, managementRating: 3 },
      ];

      const profitFactor = calculateProfitFactor(trades);
      const expectancy = calculateExpectancy(trades);
      const tiltmeter = calculateTiltmeterScore(trades);
      const stability = calculateEdgeStability(trades);

      // Profitable trader should have profit factor > 1
      expect(profitFactor).toBeGreaterThan(1);
      // Positive expectancy
      expect(expectancy).toBeGreaterThan(0);
      // Good discipline
      expect(tiltmeter).toBeGreaterThan(50);
      // Reasonable stability
      expect(stability).toBeGreaterThan(50);
    });

    it('provides meaningful metrics for a struggling trader', () => {
      const trades: TradeData[] = [
        { pnl: 50, rMultiple: 0.5, entryRating: 2, exitRating: 2, managementRating: 2 },
        { pnl: -100, rMultiple: -1, entryRating: 2, exitRating: 1, managementRating: 1 },
        { pnl: -150, rMultiple: -1.5, entryRating: 1, exitRating: 1, managementRating: 2 },
        { pnl: 30, rMultiple: 0.3, entryRating: 3, exitRating: 2, managementRating: 2 },
        { pnl: -80, rMultiple: -0.8, entryRating: 1, exitRating: 2, managementRating: 1 },
      ];

      const profitFactor = calculateProfitFactor(trades);
      const expectancy = calculateExpectancy(trades);
      const tiltmeter = calculateTiltmeterScore(trades);
      const stability = calculateEdgeStability(trades);

      // Struggling trader should have profit factor < 1
      expect(profitFactor).toBeLessThan(1);
      // Negative expectancy
      expect(expectancy).toBeLessThan(0);
      // Poor discipline
      expect(tiltmeter).toBeLessThan(50);
    });
  });
});
