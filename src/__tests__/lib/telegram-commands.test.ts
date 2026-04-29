import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Prisma before importing the module under test
vi.mock('@/lib/prisma', () => ({
  default: {
    alertConfig: { findFirst: vi.fn() },
    trade: { findMany: vi.fn() },
    tradingAccount: { findMany: vi.fn() },
    strategy: { findFirst: vi.fn() },
    challengePhase: { findFirst: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));

import prisma from '@/lib/prisma';
import { handlePnlCommand } from '@/lib/telegram-commands';

const mockFindFirst = vi.mocked(prisma.alertConfig.findFirst);
const mockFindMany = vi.mocked(prisma.trade.findMany);

const ACCOUNT_A = { id: 'acc-1', name: 'Live MT5', currency: 'EUR' };
const ACCOUNT_B = { id: 'acc-2', name: 'Prop Firm', currency: 'USD' };

function makeConfig(accounts = [ACCOUNT_A]) {
  return {
    telegramId: '12345',
    userId: 'user-1',
    enableSync: true,
    enableTrades: true,
    enableRisk: true,
    mddThreshold: 10,
    email: null,
    enableWeeklyDigest: true,
    enableMddAlerts: true,
    digestFrequency: 'WEEKLY',
    digestSendHour: 8,
    inAppToast: true,
    enableSlack: false,
    slackWebhookUrl: null,
    user: { accounts },
  };
}

function makeTrade(pnl: number | null, rMultiple: number | null = null, accountId = 'acc-1') {
  return {
    id: `trade-${Math.random().toString(36).slice(2, 8)}`,
    accountId,
    symbol: 'EURUSD',
    direction: 'LONG' as const,
    status: 'CLOSED' as const,
    entryPrice: 1.1000,
    exitPrice: pnl !== null && pnl > 0 ? 1.1050 : 1.0950,
    volume: 0.1,
    lotSize: 0.1,
    entryTime: new Date('2026-04-28T10:00:00Z'),
    exitTime: new Date('2026-04-28T14:00:00Z'),
    pnl,
    pnlPercent: pnl ? (pnl / 1000) * 100 : null,
    commission: 0,
    swap: 0,
    fees: 0,
    rMultiple,
    mae: null,
    mfe: null,
    initialStopLoss: null,
    beTriggered: false,
    closeReason: null,
    planCompliance: null,
    mood: null,
    entryRating: null,
    exitRating: null,
    managementRating: null,
    followedPlan: null,
    source: 'MT5_SYNC' as const,
    platform: 'METATRADER5' as const,
    setupType: null,
    hypotheticalData: null,
    notes: null,
    entryReason: null,
    exitReason: null,
    lessonsLearned: null,
    externalId: null,
    strategyId: null,
    ticket: null,
    stopLoss: null,
    takeProfit: null,
    normalizedPnl: null,
    originalPnl: null,
    relatedTradeIds: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('handlePnlCommand', () => {
  describe('user lookup', () => {
    it('returns error message when chatId is not linked to any account', async () => {
      mockFindFirst.mockResolvedValue(null);
      const result = await handlePnlCommand('99999', 'today');
      expect(result).toBe('No PrismJournal account is linked to this Telegram ID.');
      expect(mockFindMany).not.toHaveBeenCalled();
    });
  });

  describe('no trades', () => {
    it('returns friendly message when no closed trades exist in period', async () => {
      mockFindFirst.mockResolvedValue(makeConfig());
      mockFindMany.mockResolvedValue([]);
      const result = await handlePnlCommand('12345', 'today');
      expect(result).toBe('No closed trades found for this period.');
    });

    it('skips trades with null pnl from all calculations', async () => {
      mockFindFirst.mockResolvedValue(makeConfig());
      mockFindMany.mockResolvedValue([makeTrade(null)]);
      const result = await handlePnlCommand('12345', 'week');
      expect(result).toBe('No closed trades found for this period.');
    });
  });

  describe('metric calculations', () => {
    it('calculates net PnL as sum of non-null pnl values', async () => {
      mockFindFirst.mockResolvedValue(makeConfig());
      mockFindMany.mockResolvedValue([
        makeTrade(100),
        makeTrade(200),
        makeTrade(-50),
      ]);
      const result = await handlePnlCommand('12345', 'week');
      expect(result).toContain('+250.00');
    });

    it('calculates win rate correctly — breakeven counts as loss', async () => {
      mockFindFirst.mockResolvedValue(makeConfig());
      mockFindMany.mockResolvedValue([
        makeTrade(100),
        makeTrade(200),
        makeTrade(0),
        makeTrade(-50),
      ]);
      const result = await handlePnlCommand('12345', 'month');
      expect(result).toContain('50.0% (2/4)');
    });

    it('calculates profit factor correctly', async () => {
      mockFindFirst.mockResolvedValue(makeConfig());
      mockFindMany.mockResolvedValue([
        makeTrade(300),
        makeTrade(-100),
      ]);
      const result = await handlePnlCommand('12345', 'month');
      expect(result).toContain('3.00');
    });

    it('shows Infinity profit factor when no losses', async () => {
      mockFindFirst.mockResolvedValue(makeConfig());
      mockFindMany.mockResolvedValue([
        makeTrade(100),
        makeTrade(200),
      ]);
      const result = await handlePnlCommand('12345', 'all');
      expect(result).toContain('∞');
    });

    it('handles multi-account breakdown', async () => {
      mockFindFirst.mockResolvedValue(makeConfig([ACCOUNT_A, ACCOUNT_B]));
      mockFindMany.mockResolvedValue([
        makeTrade(100, null, 'acc-1'),
        makeTrade(-50, null, 'acc-2'),
      ]);
      const result = await handlePnlCommand('12345', 'today');
      expect(result).toContain('Live MT5');
      expect(result).toContain('Prop Firm');
    });
  });
});
