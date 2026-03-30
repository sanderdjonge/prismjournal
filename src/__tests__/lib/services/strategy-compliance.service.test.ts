import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma before importing service
vi.mock('@/lib/prisma', () => ({
  default: {
    strategy: {
      findUnique: vi.fn(),
    },
    trade: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    tradingAccount: {
      findUnique: vi.fn(),
    },
    strategyViolation: {
      create: vi.fn(),
    },
  },
}));

import prisma from '@/lib/prisma';
import { evaluateTradeCompliance } from '@/lib/services/strategy-compliance.service';

const mockPrisma = prisma as unknown as {
  strategy: { findUnique: ReturnType<typeof vi.fn> };
  trade: { findMany: ReturnType<typeof vi.fn>; count: ReturnType<typeof vi.fn> };
  tradingAccount: { findUnique: ReturnType<typeof vi.fn> };
};

// Base trade context reused across tests
const baseTrade = {
  id: 'trade-1',
  accountId: 'acc-1',
  userId: 'user-1',
  strategyId: 'strat-1',
  symbol: 'EURUSD',
  direction: 'LONG' as const,
  entryPrice: 1.1000,
  exitPrice: 1.1100,
  stopLoss: 1.0950,
  takeProfit: 1.1200,
  volume: 1.0,
  entryTime: new Date('2026-03-30T10:00:00Z'),
  exitTime: new Date('2026-03-30T11:00:00Z'),
  pnl: 100,
  initialStopLoss: 1.0950,
};

function makeStrategy(rules: unknown[]) {
  return {
    id: 'strat-1',
    rules: {
      version: 1,
      rules,
    },
  };
}

describe('evaluateTradeCompliance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no existing trades today
    mockPrisma.trade.findMany.mockResolvedValue([]);
    mockPrisma.trade.count.mockResolvedValue(0);
    mockPrisma.tradingAccount.findUnique.mockResolvedValue({ balance: 10000 });
  });

  it('returns 100% adherence when no rules configured', async () => {
    mockPrisma.strategy.findUnique.mockResolvedValue(makeStrategy([]));
    const result = await evaluateTradeCompliance(baseTrade, 'strat-1');
    expect(result.isCompliant).toBe(true);
    expect(result.adherenceScore).toBe(100);
    expect(result.violations).toHaveLength(0);
  });

  it('returns compliant when strategy not found', async () => {
    mockPrisma.strategy.findUnique.mockResolvedValue(null);
    const result = await evaluateTradeCompliance(baseTrade, 'strat-1');
    expect(result.isCompliant).toBe(true);
    expect(result.adherenceScore).toBe(100);
  });

  describe('MIN_RR_RATIO', () => {
    it('passes when R:R is above minimum', async () => {
      // risk = |1.1 - 1.095| = 0.005, reward = |1.12 - 1.1| = 0.02, rr = 4.0
      mockPrisma.strategy.findUnique.mockResolvedValue(
        makeStrategy([{ id: 'r1', type: 'MIN_RR_RATIO', enabled: true, limit: 2.0 }])
      );
      const result = await evaluateTradeCompliance(baseTrade, 'strat-1');
      expect(result.violations).toHaveLength(0);
    });

    it('violates when R:R is below minimum', async () => {
      // risk=0.005, reward via takeProfit=0.02, rr=4 — use limit 5.0 to force violation
      mockPrisma.strategy.findUnique.mockResolvedValue(
        makeStrategy([{ id: 'r1', type: 'MIN_RR_RATIO', enabled: true, limit: 5.0 }])
      );
      const result = await evaluateTradeCompliance(baseTrade, 'strat-1');
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].ruleType).toBe('MIN_RR_RATIO');
    });

    it('skips RR check when no stop loss', async () => {
      const tradeNoSL = { ...baseTrade, stopLoss: null, initialStopLoss: null };
      mockPrisma.strategy.findUnique.mockResolvedValue(
        makeStrategy([{ id: 'r1', type: 'MIN_RR_RATIO', enabled: true, limit: 2.0 }])
      );
      const result = await evaluateTradeCompliance(tradeNoSL, 'strat-1');
      expect(result.violations).toHaveLength(0);
    });
  });

  describe('MANDATORY_STOP_LOSS', () => {
    it('violates when no stop loss', async () => {
      const tradeNoSL = { ...baseTrade, stopLoss: null, initialStopLoss: null };
      mockPrisma.strategy.findUnique.mockResolvedValue(
        makeStrategy([{ id: 'r1', type: 'MANDATORY_STOP_LOSS', enabled: true, requireBeforeEntry: false }])
      );
      const result = await evaluateTradeCompliance(tradeNoSL, 'strat-1');
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].ruleType).toBe('MANDATORY_STOP_LOSS');
    });

    it('passes when stop loss present', async () => {
      mockPrisma.strategy.findUnique.mockResolvedValue(
        makeStrategy([{ id: 'r1', type: 'MANDATORY_STOP_LOSS', enabled: true, requireBeforeEntry: false }])
      );
      const result = await evaluateTradeCompliance(baseTrade, 'strat-1');
      expect(result.violations).toHaveLength(0);
    });
  });

  describe('MAX_POSITION_SIZE', () => {
    it('violates when volume exceeds limit', async () => {
      mockPrisma.strategy.findUnique.mockResolvedValue(
        makeStrategy([{ id: 'r1', type: 'MAX_POSITION_SIZE', enabled: true, limit: 0.5 }])
      );
      const result = await evaluateTradeCompliance(baseTrade, 'strat-1'); // volume=1.0
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].actualValue).toBe(1.0);
    });

    it('passes when volume within limit', async () => {
      mockPrisma.strategy.findUnique.mockResolvedValue(
        makeStrategy([{ id: 'r1', type: 'MAX_POSITION_SIZE', enabled: true, limit: 2.0 }])
      );
      const result = await evaluateTradeCompliance(baseTrade, 'strat-1');
      expect(result.violations).toHaveLength(0);
    });
  });

  describe('MAX_HOLDING_TIME', () => {
    it('violates when holding time exceeds max (60 min trade, limit 30)', async () => {
      mockPrisma.strategy.findUnique.mockResolvedValue(
        makeStrategy([{ id: 'r1', type: 'MAX_HOLDING_TIME', enabled: true, maxMinutes: 30 }])
      );
      const result = await evaluateTradeCompliance(baseTrade, 'strat-1'); // 60 min hold
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].actualValue).toBeCloseTo(60, 0);
    });

    it('passes when within max holding time', async () => {
      mockPrisma.strategy.findUnique.mockResolvedValue(
        makeStrategy([{ id: 'r1', type: 'MAX_HOLDING_TIME', enabled: true, maxMinutes: 120 }])
      );
      const result = await evaluateTradeCompliance(baseTrade, 'strat-1');
      expect(result.violations).toHaveLength(0);
    });
  });

  describe('MIN_HOLDING_TIME', () => {
    it('violates when holding time below minimum (60 min trade, limit 90)', async () => {
      mockPrisma.strategy.findUnique.mockResolvedValue(
        makeStrategy([{ id: 'r1', type: 'MIN_HOLDING_TIME', enabled: true, minMinutes: 90 }])
      );
      const result = await evaluateTradeCompliance(baseTrade, 'strat-1');
      expect(result.violations).toHaveLength(1);
    });

    it('passes when holding time exceeds minimum', async () => {
      mockPrisma.strategy.findUnique.mockResolvedValue(
        makeStrategy([{ id: 'r1', type: 'MIN_HOLDING_TIME', enabled: true, minMinutes: 30 }])
      );
      const result = await evaluateTradeCompliance(baseTrade, 'strat-1');
      expect(result.violations).toHaveLength(0);
    });
  });

  describe('ALLOWED_SYMBOLS', () => {
    it('violates when symbol not in ALLOW list', async () => {
      mockPrisma.strategy.findUnique.mockResolvedValue(
        makeStrategy([{ id: 'r1', type: 'ALLOWED_SYMBOLS', enabled: true, symbols: ['GBPUSD', 'USDJPY'], mode: 'ALLOW' }])
      );
      const result = await evaluateTradeCompliance(baseTrade, 'strat-1'); // EURUSD
      expect(result.violations).toHaveLength(1);
    });

    it('passes when symbol is in ALLOW list', async () => {
      mockPrisma.strategy.findUnique.mockResolvedValue(
        makeStrategy([{ id: 'r1', type: 'ALLOWED_SYMBOLS', enabled: true, symbols: ['EURUSD', 'GBPUSD'], mode: 'ALLOW' }])
      );
      const result = await evaluateTradeCompliance(baseTrade, 'strat-1');
      expect(result.violations).toHaveLength(0);
    });

    it('violates when symbol is in BLOCK list', async () => {
      mockPrisma.strategy.findUnique.mockResolvedValue(
        makeStrategy([{ id: 'r1', type: 'ALLOWED_SYMBOLS', enabled: true, symbols: ['EURUSD'], mode: 'BLOCK' }])
      );
      const result = await evaluateTradeCompliance(baseTrade, 'strat-1');
      expect(result.violations).toHaveLength(1);
    });
  });

  describe('MAX_DAILY_TRADES', () => {
    it('violates when trade count at or above limit', async () => {
      mockPrisma.trade.count.mockResolvedValue(5);
      mockPrisma.strategy.findUnique.mockResolvedValue(
        makeStrategy([{ id: 'r1', type: 'MAX_DAILY_TRADES', enabled: true, limit: 5 }])
      );
      const result = await evaluateTradeCompliance(baseTrade, 'strat-1');
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].ruleType).toBe('MAX_DAILY_TRADES');
    });

    it('passes when trade count below limit', async () => {
      mockPrisma.trade.count.mockResolvedValue(2);
      mockPrisma.strategy.findUnique.mockResolvedValue(
        makeStrategy([{ id: 'r1', type: 'MAX_DAILY_TRADES', enabled: true, limit: 5 }])
      );
      const result = await evaluateTradeCompliance(baseTrade, 'strat-1');
      expect(result.violations).toHaveLength(0);
    });
  });

  describe('adherence score', () => {
    it('calculates 50% adherence when 1 of 2 rules violated', async () => {
      mockPrisma.strategy.findUnique.mockResolvedValue(
        makeStrategy([
          { id: 'r1', type: 'MANDATORY_STOP_LOSS', enabled: true, requireBeforeEntry: false },
          { id: 'r2', type: 'MAX_POSITION_SIZE', enabled: true, limit: 0.5 },
        ])
      );
      // baseTrade has stopLoss (passes) but volume=1.0 (fails limit 0.5)
      const result = await evaluateTradeCompliance(baseTrade, 'strat-1');
      expect(result.violations).toHaveLength(1);
      expect(result.adherenceScore).toBe(50);
    });

    it('disabled rules are excluded from evaluation', async () => {
      mockPrisma.strategy.findUnique.mockResolvedValue(
        makeStrategy([
          { id: 'r1', type: 'MAX_POSITION_SIZE', enabled: false, limit: 0.5 },
        ])
      );
      const result = await evaluateTradeCompliance(baseTrade, 'strat-1');
      expect(result.violations).toHaveLength(0);
      expect(result.adherenceScore).toBe(100);
    });
  });
});
