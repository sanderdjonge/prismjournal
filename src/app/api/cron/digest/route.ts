import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import prisma from '@/lib/prisma';
import { sendWeeklyDigestEmail, type WeeklyDigestData } from '@/lib/email';

/**
 * Cron endpoint to send weekly digest emails to all eligible users
 *
 * Requires CRON_SECRET env var. Set it in .env for local testing.
 * Trigger: POST with Authorization: Bearer <CRON_SECRET>
 */

export async function POST() {
  const headersList = await headers();
  const authHeader = headersList.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const currentHour = new Date().getUTCHours();
    const isMonday = new Date().getUTCDay() === 1;

    // Find all users with digest enabled whose send hour matches current UTC hour
    const alertConfigs = await prisma.alertConfig.findMany({
      where: {
        email: { not: null },
        enableWeeklyDigest: true,
        digestSendHour: currentHour,
      },
      include: {
        user: {
          include: {
            accounts: {
              where: { isActive: true },
              take: 1,
            },
          },
        },
      },
    });

    const results: { email: string; success: boolean; error?: string }[] = [];

    // Filter: WEEKLY only sends on Monday, DAILY sends every day
    const eligible = alertConfigs.filter(c =>
      (c.digestFrequency ?? 'WEEKLY') === 'DAILY' || isMonday
    );

    for (const config of eligible) {
      const email = config.email!;
      const account = config.user.accounts[0];

      if (!account) {
        results.push({ email, success: false, error: 'No active account' });
        continue;
      }

      try {
        const digestData = await computeWeeklyDigestData(account.id, config.userId);
        
        const result = await sendWeeklyDigestEmail({
          ...digestData,
          email,
          dashboardUrl: process.env.NEXTAUTH_URL || 'http://localhost:3000',
        });

        results.push({ email, success: result.success, error: result.error });
      } catch (error) {
        results.push({ email, success: false, error: String(error) });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;

    return NextResponse.json({
      success: true,
      sent: successCount,
      failed: failCount,
      results,
    });
  } catch (error) {
    console.error('Cron digest failed:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

/**
 * GET endpoint for health check / manual trigger (requires CRON_SECRET)
 */
export async function GET() {
  const headersList = await headers();
  const authHeader = headersList.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Return count of users who would receive digest
  const count = await prisma.alertConfig.count({
    where: {
      email: { not: null },
      enableWeeklyDigest: true,
    },
  });

  return NextResponse.json({
    message: 'Weekly digest cron endpoint',
    eligibleUsers: count,
    schedule: 'Call this endpoint every hour. Sends to users whose digestSendHour matches current UTC hour (weekly: Mondays only, daily: every day).',
  });
}

/**
 * Compute weekly digest data for an account
 */
async function computeWeeklyDigestData(accountId: string, userId: string): Promise<Omit<WeeklyDigestData, 'email' | 'dashboardUrl'>> {
  const now = new Date();
  
  // Get start of current week (Monday)
  const weekEnd = new Date(now);
  weekEnd.setHours(23, 59, 59, 999);
  
  const weekStart = new Date(now);
  const dayOfWeek = weekStart.getDay();
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Adjust so Monday is 0
  weekStart.setDate(weekStart.getDate() - diff);
  weekStart.setHours(0, 0, 0, 0);

  // Get previous week for comparison
  const prevWeekEnd = new Date(weekStart);
  prevWeekEnd.setTime(prevWeekEnd.getTime() - 1);
  
  const prevWeekStart = new Date(prevWeekEnd);
  prevWeekStart.setDate(prevWeekStart.getDate() - 6);
  prevWeekStart.setHours(0, 0, 0, 0);

  // Fetch trades for current week
  const trades = await prisma.trade.findMany({
    where: {
      accountId,
      exitTime: {
        gte: weekStart,
        lte: weekEnd,
      },
      pnl: { not: null },
    },
    orderBy: { exitTime: 'asc' },
  });

  // Fetch trades for previous week (for win rate comparison)
  const prevWeekTrades = await prisma.trade.findMany({
    where: {
      accountId,
      exitTime: {
        gte: prevWeekStart,
        lte: prevWeekEnd,
      },
      pnl: { not: null },
    },
  });

  // Get user info
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });

  // Get latest equity snapshot for account balance
  const latestSnapshot = await prisma.equitySnapshot.findFirst({
    where: { accountId },
    orderBy: { timestamp: 'desc' },
  });

  // Calculate metrics
  const totalTrades = trades.length;
  const wins = trades.filter(t => (t.pnl || 0) > 0);
  const losses = trades.filter(t => (t.pnl || 0) < 0);
  const winCount = wins.length;
  const lossCount = losses.length;
  
  const netPnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const winRate = totalTrades > 0 ? (winCount / totalTrades) * 100 : 0;
  
  // Previous week win rate
  const prevWinCount = prevWeekTrades.filter(t => (t.pnl || 0) > 0).length;
  const prevWinRate = prevWeekTrades.length > 0 
    ? (prevWinCount / prevWeekTrades.length) * 100 
    : null;
  const winRateChange = prevWinRate !== null ? winRate - prevWinRate : null;

  // Profit factor
  const grossProfit = wins.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const grossLoss = Math.abs(losses.reduce((sum, t) => sum + (t.pnl || 0), 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  // Average R:R
  const tradesWithR = trades.filter(t => t.rMultiple !== null);
  const avgRR = tradesWithR.length > 0
    ? tradesWithR.reduce((sum, t) => sum + (t.rMultiple || 0), 0) / tradesWithR.length
    : 0;

  // Return on equity
  const accountBalance = latestSnapshot?.equity || latestSnapshot?.balance || 10000;
  const returnOnEquity = (netPnl / accountBalance) * 100;

  // Daily P&L
  const dailyPnlMap = new Map<string, number>();
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  trades.forEach(trade => {
    if (trade.exitTime) {
      const dayKey = trade.exitTime.toISOString().split('T')[0];
      dailyPnlMap.set(dayKey, (dailyPnlMap.get(dayKey) || 0) + (trade.pnl || 0));
    }
  });

  const dailyPnl = Array.from(dailyPnlMap.entries())
    .map(([date, pnl]) => ({
      day: dayNames[new Date(date).getDay()],
      pnl,
    }))
    .sort((a, b) => {
      const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      return dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day);
    });

  // Top instruments (case-insensitive grouping)
  const instrumentMap = new Map<string, { trades: number; wins: number; pnl: number; originalSymbol: string }>();
  trades.forEach(trade => {
    const normalizedSymbol = trade.symbol.toUpperCase();
    const current = instrumentMap.get(normalizedSymbol) || { trades: 0, wins: 0, pnl: 0, originalSymbol: trade.symbol };
    current.trades++;
    current.pnl += trade.pnl || 0;
    if ((trade.pnl || 0) > 0) current.wins++;
    instrumentMap.set(normalizedSymbol, current);
  });

  const topInstruments = Array.from(instrumentMap.entries())
    .map(([, data]) => ({
      symbol: data.originalSymbol,
      trades: data.trades,
      winRate: (data.wins / data.trades) * 100,
      pnl: data.pnl,
    }))
    .sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl))
    .slice(0, 5);

  // Risk metrics
  const pnlValues = trades.map(t => t.pnl || 0);
  const maxDrawdown = calculateMaxDrawdown(pnlValues);
  const largestWin = Math.max(0, ...pnlValues);
  const largestLoss = Math.min(0, ...pnlValues);
  const avgWin = wins.length > 0 ? wins.reduce((sum, t) => sum + (t.pnl || 0), 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((sum, t) => sum + (t.pnl || 0), 0) / losses.length) : 0;

  return {
    userName: user?.name || undefined,
    weekStart,
    weekEnd,
    netPnl,
    returnOnEquity,
    totalTrades,
    winCount,
    lossCount,
    winRate,
    winRateChange,
    profitFactor: isFinite(profitFactor) ? profitFactor : 0,
    avgRR,
    dailyPnl,
    topInstruments,
    maxDrawdown,
    largestWin,
    largestLoss,
    avgWin,
    avgLoss,
    accountBalance,
  };
}

/**
 * Calculate maximum drawdown from a series of P&L values
 */
function calculateMaxDrawdown(pnlValues: number[]): number {
  if (pnlValues.length === 0) return 0;

  let peak = 0;
  let maxDD = 0;
  let runningSum = 0;

  for (const pnl of pnlValues) {
    runningSum += pnl;
    if (runningSum > peak) {
      peak = runningSum;
    }
    const dd = peak > 0 ? ((peak - runningSum) / peak) * 100 : 0;
    if (dd > maxDD) {
      maxDD = dd;
    }
  }

  return maxDD;
}

export const runtime = 'nodejs';
