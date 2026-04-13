import prisma from './prisma';
import { calculateProfitFactor, formatProfitFactor as canonicalFormatProfitFactor } from './analytics';

export const PNL_PERIODS = ['today', 'week', 'month', 'all'] as const;
export type PnlPeriod = typeof PNL_PERIODS[number];

export const PNL_HELP =
    `📊 <b>PrismJournal PnL</b>\n\n` +
    `Usage:\n` +
    `  /pnl today\n` +
    `  /pnl week\n` +
    `  /pnl month\n` +
    `  /pnl all`;

const PERIOD_LABELS: Record<PnlPeriod, string> = {
  today: 'Today',
  week: 'This Week',
  month: 'This Month',
  all: 'All Time',
};

function getPeriodStart(period: PnlPeriod, now: Date): Date | null {
  if (period === 'all') return null;
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  if (period === 'today') return new Date(Date.UTC(y, m, d));
  if (period === 'month') return new Date(Date.UTC(y, m, 1));
  // week: find Monday. getUTCDay() returns 0=Sun..6=Sat. (day+6)%7 = days since Monday (Sun→6).
  const day = now.getUTCDay();
  const offset = (day + 6) % 7;
  return new Date(Date.UTC(y, m, d - offset));
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatSign(n: number): string {
  return (n >= 0 ? '+' : '') + n.toFixed(2);
}

interface TradeLike {
  pnl: number | null;
  rMultiple: number | null;
  accountId: string;
}

interface AccountSummary {
  netPnl: number;
  wins: number;
  total: number;
  grossProfits: number;
  grossLosses: number;
  rMultiples: number[];
}

function computeSummary(trades: TradeLike[], accountId?: string): AccountSummary {
  const filtered = accountId ? trades.filter(t => t.accountId === accountId) : trades;
  let netPnl = 0, wins = 0, total = 0, grossProfits = 0, grossLosses = 0;
  const rMultiples: number[] = [];
  for (const t of filtered) {
    if (t.pnl === null) continue;
    total++;
    netPnl += t.pnl;
    if (t.pnl > 0) { wins++; grossProfits += t.pnl; }
    else if (t.pnl < 0) { grossLosses += Math.abs(t.pnl); }
    if (t.rMultiple !== null && t.rMultiple !== undefined) {
      rMultiples.push(t.rMultiple);
    }
  }
  return { netPnl, wins, total, grossProfits, grossLosses, rMultiples };
}

function formatProfitFactor(s: AccountSummary): string {
  if (s.total === 0) return '0.00';
  return canonicalFormatProfitFactor(calculateProfitFactor(s.grossProfits, s.grossLosses));
}

function formatWinRate(s: AccountSummary): string {
  if (s.total === 0) return '0.0% (0/0)';
  const pct = ((s.wins / s.total) * 100).toFixed(1);
  return `${pct}% (${s.wins}/${s.total})`;
}

function formatOverallPnl(s: AccountSummary, currencies: string[]): string {
  const allSame = currencies.length > 0 && currencies.every(c => c === currencies[0]);
  if (allSame) return `${formatSign(s.netPnl)} ${currencies[0]}`;
  return `${formatSign(s.netPnl)} (mixed currencies — see breakdown)`;
}

const MAX_TELEGRAM_LEN = 4096;

export async function handlePnlCommand(chatId: string, period: PnlPeriod): Promise<string> {
  try {
    const config = await prisma.alertConfig.findFirst({
      where: { telegramId: chatId },
      include: {
        user: {
          include: {
            accounts: { select: { id: true, name: true, currency: true } },
          },
        },
      },
    });

    if (!config) {
      return 'No PrismJournal account is linked to this Telegram ID.';
    }

    const accounts = config.user.accounts;
    const accountIds = accounts.map(a => a.id);
    const now = new Date();
    const periodStart = getPeriodStart(period, now);

    const exitTimeFilter: { not: null; lte: Date; gte?: Date } = {
      not: null,
      lte: now,
      ...(periodStart ? { gte: periodStart } : {}),
    };

    const trades = await prisma.trade.findMany({
      where: {
        accountId: { in: accountIds },
        status: 'CLOSED',
        exitTime: exitTimeFilter,
      },
      select: { pnl: true, rMultiple: true, accountId: true },
    });

    const overall = computeSummary(trades);
    if (overall.total === 0) {
      return 'No closed trades found for this period.';
    }

    const currencies = accounts.map(a => a.currency ?? 'USD');
    const header = `📊 <b>PnL Summary — ${PERIOD_LABELS[period]}</b>`;
    const overallSection = [
      `Net PnL:       ${formatOverallPnl(overall, currencies)}`,
      `Win Rate:      ${formatWinRate(overall)}`,
      `Profit Factor: ${formatProfitFactor(overall)}`,
      ...(overall.rMultiples.length > 0
        ? [`Avg RR:        ${(overall.rMultiples.reduce((a, b) => a + b, 0) / overall.rMultiples.length).toFixed(1)}R`]
        : []),
    ].join('\n');

    let body = `${header}\n\n${overallSection}`;

    // Per-account breakdown — only when more than one account
    if (accounts.length > 1) {
      const accountTrades = accounts
        .map(account => {
          const s = computeSummary(trades, account.id);
          if (s.total === 0) return null;
          const safeName = escapeHtml(account.name ?? account.id);
          const currency = account.currency ?? '';
          return `${safeName} (${currency})\n  PnL: ${formatSign(s.netPnl)} · WR: ${((s.wins / s.total) * 100).toFixed(0)}%`;
        })
        .filter(Boolean)
        .join('\n\n');

      if (accountTrades) {
        const divider = '\n\n──────────────────\n';
        const candidate = body + divider + accountTrades;
        if (candidate.length <= MAX_TELEGRAM_LEN) {
          body = candidate;
        } else {
          // Truncate per-account section to fit
          const available = MAX_TELEGRAM_LEN - body.length - divider.length - 1;
          body = body + divider + accountTrades.slice(0, available) + '…';
        }
      }
    }

    if (body.length > MAX_TELEGRAM_LEN) {
      body = body.slice(0, MAX_TELEGRAM_LEN - 1) + '…';
    }
    return body;
  } catch (e) {
    console.error('[telegram-commands] handlePnlCommand error:', e);
    return 'Something went wrong. Please try again later.';
  }
}
