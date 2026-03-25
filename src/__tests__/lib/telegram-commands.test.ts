import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Prisma before importing the module under test
vi.mock('@/lib/prisma', () => ({
  default: {
    alertConfig: { findFirst: vi.fn() },
    trade: { findMany: vi.fn() },
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
    user: { accounts },
  };
}

function makeTrade(pnl: number | null, rMultiple: number | null = null, accountId = 'acc-1') {
  return { pnl, rMultiple, accountId };
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
      // 2 wins, 1 breakeven (loss), 1 loss => 2/4 = 50%
      mockFindMany.mockResolvedValue([
        makeTrade(100),
        makeTrade(200),
        makeTrade(0),   // breakeven = loss
        makeTrade(-50),
      ]);
      const result = await handlePnlCommand('12345', 'month');
      expect(result).toContain('50.0% (2/4)');
    });

    it('calculates profit factor correctly', async () => {
      mockFindFirst.mockResolvedValue(makeConfig());
      // gross profits: 300, gross losses: 100 => PF = 3.00
      mockFindMany.mockResolvedValue([
        makeTrade(100),
        makeTrade(200),
        makeTrade(-100),
      ]);
      const result = await handlePnlCommand('12345', 'all');
      expect(result).toContain('3.00');
    });

    it('shows ∞ for profit factor when there are no losses', async () => {
      mockFindFirst.mockResolvedValue(makeConfig());
      mockFindMany.mockResolvedValue([
        makeTrade(100),
        makeTrade(200),
      ]);
      const result = await handlePnlCommand('12345', 'week');
      expect(result).toContain('∞');
    });

    it('includes avg RR line when rMultiple data is present', async () => {
      mockFindFirst.mockResolvedValue(makeConfig());
      mockFindMany.mockResolvedValue([
        makeTrade(100, 2.0),
        makeTrade(-50, -1.0),
      ]);
      const result = await handlePnlCommand('12345', 'week');
      expect(result).toContain('0.5R');
    });

    it('omits avg RR line when no trades have rMultiple', async () => {
      mockFindFirst.mockResolvedValue(makeConfig());
      mockFindMany.mockResolvedValue([makeTrade(100), makeTrade(-50)]);
      const result = await handlePnlCommand('12345', 'week');
      expect(result).not.toContain('Avg RR');
    });
  });

  describe('currency handling', () => {
    it('shows single currency in totals when all accounts share the same currency', async () => {
      mockFindFirst.mockResolvedValue(makeConfig([ACCOUNT_A]));
      mockFindMany.mockResolvedValue([makeTrade(100, null, 'acc-1')]);
      const result = await handlePnlCommand('12345', 'week');
      expect(result).toContain('EUR');
      expect(result).not.toContain('mixed currencies');
    });

    it('shows mixed currencies note in totals when accounts have different currencies', async () => {
      mockFindFirst.mockResolvedValue(makeConfig([ACCOUNT_A, ACCOUNT_B]));
      mockFindMany.mockResolvedValue([
        makeTrade(100, null, 'acc-1'),
        makeTrade(200, null, 'acc-2'),
      ]);
      const result = await handlePnlCommand('12345', 'week');
      expect(result).toContain('mixed currencies');
    });
  });

  describe('per-account breakdown', () => {
    it('omits per-account section when user has only one account', async () => {
      mockFindFirst.mockResolvedValue(makeConfig([ACCOUNT_A]));
      mockFindMany.mockResolvedValue([makeTrade(100, null, 'acc-1')]);
      const result = await handlePnlCommand('12345', 'week');
      expect(result).not.toContain('──');
    });

    it('includes per-account breakdown when user has multiple accounts', async () => {
      mockFindFirst.mockResolvedValue(makeConfig([ACCOUNT_A, ACCOUNT_B]));
      mockFindMany.mockResolvedValue([
        makeTrade(100, null, 'acc-1'),
        makeTrade(200, null, 'acc-2'),
      ]);
      const result = await handlePnlCommand('12345', 'week');
      expect(result).toContain('Live MT5');
      expect(result).toContain('Prop Firm');
    });

    it('HTML-escapes account names containing special characters', async () => {
      const dangerousAccount = { id: 'acc-x', name: 'A&B <Test>', currency: 'EUR' };
      mockFindFirst.mockResolvedValue(makeConfig([ACCOUNT_A, dangerousAccount]));
      mockFindMany.mockResolvedValue([
        makeTrade(100, null, 'acc-1'),
        makeTrade(50, null, 'acc-x'),
      ]);
      const result = await handlePnlCommand('12345', 'week');
      expect(result).toContain('A&amp;B &lt;Test&gt;');
      expect(result).not.toContain('A&B <Test>');
    });
  });

  describe('period labels in message header', () => {
    it('labels the period correctly in the message header', async () => {
      mockFindFirst.mockResolvedValue(makeConfig());
      mockFindMany.mockResolvedValue([makeTrade(100)]);

      const today = await handlePnlCommand('12345', 'today');
      expect(today).toContain('Today');

      const week = await handlePnlCommand('12345', 'week');
      expect(week).toContain('This Week');

      const month = await handlePnlCommand('12345', 'month');
      expect(month).toContain('This Month');

      const all = await handlePnlCommand('12345', 'all');
      expect(all).toContain('All Time');
    });
  });

  describe('error handling', () => {
    it('returns a generic error message when Prisma throws', async () => {
      mockFindFirst.mockRejectedValue(new Error('DB connection failed'));
      const result = await handlePnlCommand('12345', 'week');
      expect(result).toBe('Something went wrong. Please try again later.');
    });
  });

  describe('period query filters', () => {
    it('passes gte filter for non-all periods and no gte for all', async () => {
      mockFindFirst.mockResolvedValue(makeConfig());
      mockFindMany.mockResolvedValue([]);

      await handlePnlCommand('12345', 'all');
      const allCall = mockFindMany.mock.calls[0][0] as { where: { exitTime?: object } };
      // Should have lte but NOT gte for 'all'
      const exitTimeFilter = allCall?.where?.exitTime as Record<string, unknown> | undefined;
      expect(exitTimeFilter).toBeDefined();
      expect(exitTimeFilter?.gte).toBeUndefined();
      expect(exitTimeFilter?.lte).toBeDefined();

      vi.clearAllMocks();
      mockFindFirst.mockResolvedValue(makeConfig());
      mockFindMany.mockResolvedValue([]);

      await handlePnlCommand('12345', 'today');
      const todayCall = mockFindMany.mock.calls[0][0] as { where: { exitTime?: object } };
      const todayFilter = todayCall?.where?.exitTime as Record<string, unknown> | undefined;
      expect(todayFilter?.gte).toBeInstanceOf(Date);
    });
  });
});
