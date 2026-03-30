import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  default: {
    strategyViolation: {
      findMany: vi.fn(),
    },
    trade: {
      count: vi.fn(),
    },
    tradingAccount: {
      findMany: vi.fn(),
    },
    tiltmeterSnapshot: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import prisma from '@/lib/prisma';
import {
  getComplianceStats,
  getDollarCostOfViolations,
  calculateTiltmeter,
} from '@/lib/services/tiltmeter.service';

// Note: calculateTiltmeter only uses strategyViolation + tiltmeterSnapshot
// getComplianceStats also uses trade.count and tradingAccount.findMany
const mockPrisma = prisma as unknown as {
  strategyViolation: { findMany: ReturnType<typeof vi.fn> };
  trade: { count: ReturnType<typeof vi.fn> };
  tradingAccount: { findMany: ReturnType<typeof vi.fn> };
  tiltmeterSnapshot: { create: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
};

describe('getComplianceStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.tradingAccount.findMany.mockResolvedValue([{ id: 'acc-1' }]);
    mockPrisma.trade.count.mockResolvedValue(10);
    mockPrisma.tiltmeterSnapshot.create.mockResolvedValue({});
  });

  it('returns 100% adherence when no violations', async () => {
    mockPrisma.strategyViolation.findMany.mockResolvedValue([]);
    const stats = await getComplianceStats('user-1');
    expect(stats.adherenceRate).toBe(100);
    expect(stats.violationCount).toBe(0);
    expect(stats.compliantTrades).toBe(10);
  });

  it('calculates adherence rate correctly with violations', async () => {
    // 2 distinct trades violated out of 10 total
    mockPrisma.strategyViolation.findMany.mockResolvedValue([
      { tradeId: 'trade-1', ruleType: 'MAX_DAILY_TRADES', pnlImpact: -50 },
      { tradeId: 'trade-2', ruleType: 'MANDATORY_STOP_LOSS', pnlImpact: -100 },
      { tradeId: 'trade-2', ruleType: 'MAX_POSITION_SIZE', pnlImpact: -100 }, // same trade, 2 rules
    ]);
    const stats = await getComplianceStats('user-1');
    expect(stats.violationCount).toBe(3);
    expect(stats.compliantTrades).toBe(8); // 10 - 2 unique violated trades
    expect(stats.adherenceRate).toBe(80);
  });

  it('counts violations by type correctly', async () => {
    mockPrisma.strategyViolation.findMany.mockResolvedValue([
      { tradeId: 'trade-1', ruleType: 'MAX_DAILY_TRADES', pnlImpact: 0 },
      { tradeId: 'trade-2', ruleType: 'MAX_DAILY_TRADES', pnlImpact: 0 },
      { tradeId: 'trade-3', ruleType: 'MANDATORY_STOP_LOSS', pnlImpact: 0 },
    ]);
    const stats = await getComplianceStats('user-1');
    expect(stats.violationsByType['MAX_DAILY_TRADES']).toBe(2);
    expect(stats.violationsByType['MANDATORY_STOP_LOSS']).toBe(1);
  });
});

describe('getDollarCostOfViolations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('aggregates P&L impact by strategy', async () => {
    mockPrisma.strategyViolation.findMany.mockResolvedValue([
      { strategyId: 'strat-1', pnlImpact: -50, strategy: { name: 'Scalping' } },
      { strategyId: 'strat-1', pnlImpact: -100, strategy: { name: 'Scalping' } },
      { strategyId: 'strat-2', pnlImpact: -200, strategy: { name: 'Swing' } },
    ]);
    const result = await getDollarCostOfViolations('user-1');
    expect(result.total).toBe(-350);
    expect(result.byStrategy['Scalping']).toBe(-150);
    expect(result.byStrategy['Swing']).toBe(-200);
  });

  it('returns zero totals when no violations', async () => {
    mockPrisma.strategyViolation.findMany.mockResolvedValue([]);
    const result = await getDollarCostOfViolations('user-1');
    expect(result.total).toBe(0);
    expect(Object.keys(result.byStrategy)).toHaveLength(0);
  });
});

describe('calculateTiltmeter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.tiltmeterSnapshot.create.mockResolvedValue({});
  });

  it('returns score of 0 when no violations', async () => {
    mockPrisma.strategyViolation.findMany.mockResolvedValue([]);
    const result = await calculateTiltmeter('user-1', undefined, 30, false);
    expect(result.score).toBe(0);
    expect(result.totalViolations).toBe(0);
    expect(Object.keys(result.components)).toHaveLength(0);
  });

  it('scores more serious violations higher', async () => {
    const now = new Date();
    // MAX_DAILY_LOSS weight=2.0 vs MAX_HOLDING_TIME weight=0.3
    const violationHighSeverity = [
      { ruleType: 'MAX_DAILY_LOSS', occurredAt: now, pnlImpact: -500 },
    ];
    const violationLowSeverity = [
      { ruleType: 'MAX_HOLDING_TIME', occurredAt: now, pnlImpact: -10 },
    ];

    mockPrisma.strategyViolation.findMany.mockResolvedValueOnce(violationHighSeverity);
    const highResult = await calculateTiltmeter('user-1', undefined, 30, false);

    mockPrisma.strategyViolation.findMany.mockResolvedValueOnce(violationLowSeverity);
    const lowResult = await calculateTiltmeter('user-1', undefined, 30, false);

    expect(highResult.score).toBeGreaterThan(lowResult.score);
  });

  it('does NOT save snapshot when persist=false', async () => {
    mockPrisma.strategyViolation.findMany.mockResolvedValue([]);
    await calculateTiltmeter('user-1', undefined, 30, false);
    expect(mockPrisma.tiltmeterSnapshot.create).not.toHaveBeenCalled();
  });

  it('DOES save snapshot when persist=true', async () => {
    mockPrisma.strategyViolation.findMany.mockResolvedValue([]);
    await calculateTiltmeter('user-1', undefined, 30, true);
    expect(mockPrisma.tiltmeterSnapshot.create).toHaveBeenCalledTimes(1);
  });
});
