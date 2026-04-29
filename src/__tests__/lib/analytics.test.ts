import { describe, it, expect } from 'vitest';
import {
  calculateProfitFactor,
  calculateProfitFactorFromTrades,
  serializeProfitFactor,
  formatProfitFactor,
  calculateWinRate,
  calculateWinRatePercent,
  calculateWinRateFromTrades,
  calculateMaxDrawdownPercent,
  calculateMaxDrawdownFromEquity,
  calculateMaxDrawdownFromBalance,
  calculateDollarExpectancy,
  calculateDollarExpectancyFromValues,
  calculateRExpectancy,
  calculateAvgRMultiple,
  calculateStandardDeviation,
  calculateTiltmeterScore,
  calculateEdgeStability,
} from '@/lib/analytics';
import type { TradeData } from '@/lib/analytics';

describe('calculateProfitFactor', () => {
  it('calculates profit factor correctly', () => {
    expect(calculateProfitFactor(300, 100)).toBe(3);
  });

  it('returns Infinity when grossLoss is 0 and grossProfit > 0', () => {
    expect(calculateProfitFactor(350, 0)).toBe(Infinity);
  });

  it('returns Infinity when both are 0 (no trades)', () => {
    expect(calculateProfitFactor(0, 0)).toBe(Infinity);
  });

  it('returns 0 when only losses', () => {
    expect(calculateProfitFactor(0, 300)).toBe(0);
  });

  it('handles decimal values', () => {
    expect(calculateProfitFactor(100, 75)).toBeCloseTo(1.333, 2);
  });

  it('never returns negative', () => {
    expect(calculateProfitFactor(-50, 100)).toBe(0);
  });
});

describe('calculateProfitFactorFromTrades', () => {
  it('calculates from trade array', () => {
    const trades: TradeData[] = [
      { pnl: 100 }, { pnl: 200 }, { pnl: -50 }, { pnl: -50 },
    ];
    expect(calculateProfitFactorFromTrades(trades)).toBe(3);
  });

  it('returns Infinity when no losses', () => {
    const trades: TradeData[] = [{ pnl: 100 }, { pnl: 200 }];
    expect(calculateProfitFactorFromTrades(trades)).toBe(Infinity);
  });

  it('returns 0 when only losses', () => {
    const trades: TradeData[] = [{ pnl: -100 }, { pnl: -200 }];
    expect(calculateProfitFactorFromTrades(trades)).toBe(0);
  });

  it('returns Infinity for empty array', () => {
    expect(calculateProfitFactorFromTrades([])).toBe(Infinity);
  });

  it('handles breakeven trades (pnl = 0)', () => {
    const trades: TradeData[] = [{ pnl: 100 }, { pnl: 0 }, { pnl: -50 }];
    expect(calculateProfitFactorFromTrades(trades)).toBe(2);
  });
});

describe('serializeProfitFactor', () => {
  it('returns null for Infinity', () => {
    expect(serializeProfitFactor(Infinity)).toBeNull();
  });

  it('returns null for -Infinity', () => {
    expect(serializeProfitFactor(-Infinity)).toBeNull();
  });

  it('rounds finite values to 2dp', () => {
    expect(serializeProfitFactor(1.333)).toBe(1.33);
  });

  it('returns 0 for 0', () => {
    expect(serializeProfitFactor(0)).toBe(0);
  });
});

describe('formatProfitFactor', () => {
  it('returns ∞ for Infinity', () => {
    expect(formatProfitFactor(Infinity)).toBe('∞');
  });

  it('formats finite values to 2dp', () => {
    expect(formatProfitFactor(2.5)).toBe('2.50');
  });
});

describe('calculateWinRate', () => {
  it('calculates win rate as decimal', () => {
    expect(calculateWinRate(3, 5)).toBe(0.6);
  });

  it('returns 0 when no trades', () => {
    expect(calculateWinRate(0, 0)).toBe(0);
  });

  it('returns 1 when all wins', () => {
    expect(calculateWinRate(5, 5)).toBe(1);
  });
});

describe('calculateWinRatePercent', () => {
  it('calculates win rate as percentage', () => {
    expect(calculateWinRatePercent(3, 5)).toBe(60);
  });

  it('returns 0 when no trades', () => {
    expect(calculateWinRatePercent(0, 0)).toBe(0);
  });
});

describe('calculateWinRateFromTrades', () => {
  it('counts only pnl > 0 as wins (strict)', () => {
    const trades: TradeData[] = [
      { pnl: 100 }, { pnl: 0 }, { pnl: -50 },
    ];
    expect(calculateWinRateFromTrades(trades)).toBeCloseTo(1 / 3);
  });

  it('returns 0 for empty array', () => {
    expect(calculateWinRateFromTrades([])).toBe(0);
  });
});

describe('calculateMaxDrawdownPercent', () => {
  it('calculates max drawdown from pnl series', () => {
    const pnlValues = [100, -50, 200, -150];
    expect(calculateMaxDrawdownPercent(pnlValues)).toBeCloseTo(60, 0);
  });

  it('returns 0 for empty array', () => {
    expect(calculateMaxDrawdownPercent([])).toBe(0);
  });

  it('returns 0 when always profitable', () => {
    expect(calculateMaxDrawdownPercent([100, 200, 300])).toBe(0);
  });

  it('returns 0 when never goes above zero cumulative', () => {
    expect(calculateMaxDrawdownPercent([-100, -50, -200])).toBe(0);
  });

  it('caps at 100% when equity starts near zero (near-zero-peak explosion)', () => {
    // Peak reaches only 0.50, then drops to -13.00. Without cap: (0.50-(-13))/0.50*100 = 2700%
    // With cap: 100%
    expect(calculateMaxDrawdownPercent([0.50, -13.50])).toBe(100);
  });

  it('caps at 100% for extreme drawdown scenarios', () => {
    // Peak = 1.0, drops to -99. Without cap: 10000%. With cap: 100%
    expect(calculateMaxDrawdownPercent([1, -100])).toBe(100);
  });
});

describe('calculateMaxDrawdownFromBalance', () => {
  it('starts drawdown from starting balance', () => {
    const pnlValues = [-50, 100, -80];
    expect(calculateMaxDrawdownFromBalance(pnlValues, 1000)).toBeCloseTo(7.62, 1);
  });

  it('returns 0 for empty array', () => {
    expect(calculateMaxDrawdownFromBalance([], 1000)).toBe(0);
  });
});

describe('calculateDollarExpectancy', () => {
  it('calculates average PnL per trade', () => {
    const trades: TradeData[] = [{ pnl: 100 }, { pnl: -50 }];
    expect(calculateDollarExpectancy(trades)).toBe(25);
  });

  it('returns 0 for empty array', () => {
    expect(calculateDollarExpectancy([])).toBe(0);
  });
});

describe('calculateRExpectancy', () => {
  it('calculates average R-multiple (only trades with rMultiple)', () => {
    const trades: TradeData[] = [
      { pnl: 100, rMultiple: 2 }, { pnl: -50, rMultiple: -0.5 },
    ];
    expect(calculateRExpectancy(trades)).toBeCloseTo(0.75, 2);
  });

  it('returns 0 when no trades have rMultiple', () => {
    const trades: TradeData[] = [{ pnl: 100 }, { pnl: -50 }];
    expect(calculateRExpectancy(trades)).toBe(0);
  });

  it('excludes null rMultiple from denominator', () => {
    const trades: TradeData[] = [
      { pnl: 100, rMultiple: 2 }, { pnl: 50 },
    ];
    expect(calculateRExpectancy(trades)).toBe(2);
  });
});

describe('calculateAvgRMultiple', () => {
  it('calculates average R-multiple', () => {
    const trades: TradeData[] = [
      { pnl: 100, rMultiple: 1.5 }, { pnl: -50, rMultiple: -0.5 },
    ];
    expect(calculateAvgRMultiple(trades)).toBeCloseTo(0.5, 2);
  });

  it('returns 0 when no trades have rMultiple', () => {
    expect(calculateAvgRMultiple([{ pnl: 100 }])).toBe(0);
  });
});

describe('calculateStandardDeviation', () => {
  it('calculates population standard deviation', () => {
    expect(calculateStandardDeviation([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2, 0);
  });

  it('returns 0 for empty array', () => {
    expect(calculateStandardDeviation([])).toBe(0);
  });

  it('returns 0 for single value', () => {
    expect(calculateStandardDeviation([5])).toBe(0);
  });

  it('returns 0 for all same values', () => {
    expect(calculateStandardDeviation([3, 3, 3])).toBe(0);
  });
});

describe('calculateTiltmeterScore', () => {
  it('returns 100 when no trades', () => {
    expect(calculateTiltmeterScore([])).toBe(100);
  });

  it('returns 100 for perfect ratings', () => {
    const trades: TradeData[] = [
      { pnl: 100, entryRating: 5, exitRating: 5, managementRating: 5 },
    ];
    expect(calculateTiltmeterScore(trades)).toBe(100);
  });

  it('returns 0 for worst ratings', () => {
    const trades: TradeData[] = [
      { pnl: -100, entryRating: 1, exitRating: 1, managementRating: 1 },
    ];
    expect(calculateTiltmeterScore(trades)).toBe(0);
  });
});

describe('calculateEdgeStability', () => {
  it('returns 100 for fewer than 2 trades with rMultiple', () => {
    expect(calculateEdgeStability([{ pnl: 100, rMultiple: 2 }])).toBe(100);
  });

  it('returns 100 for consistent R-multiples', () => {
    const trades: TradeData[] = [
      { pnl: 100, rMultiple: 1 }, { pnl: 100, rMultiple: 1 },
    ];
    expect(calculateEdgeStability(trades)).toBe(100);
  });

  it('decreases with higher variance', () => {
    const stable = calculateEdgeStability([
      { pnl: 100, rMultiple: 1 }, { pnl: 100, rMultiple: 1.1 },
    ]);
    const volatile = calculateEdgeStability([
      { pnl: 100, rMultiple: 5 }, { pnl: -100, rMultiple: -2 },
    ]);
    expect(stable).toBeGreaterThan(volatile);
  });
});
