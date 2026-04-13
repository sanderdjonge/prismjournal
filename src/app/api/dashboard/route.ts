import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getAllUserAccounts } from '@/lib/getAccount';
import { calculateProfitFactorFromTrades, calculateMaxDrawdownPercent } from '@/lib/analytics';
import { formatDistanceToNow } from '@/lib/formatTime';
import { withAuth } from '@/lib/api/withAuth';
import { cacheGet, cacheSet } from '@/lib/api/cache';
import { ok } from '@/lib/api/responses';
import type { Session } from 'next-auth';

const emptyResponse = {
    equity: [],
    allTimeEquity: [],
    trades: [],
    calendar: [],
    winRate: 0,
    profitFactor: 0,
    totalTrades: 0,
    totalPnl: 0,
    expectancy: 0,
    maxDrawdown: 0,
    avgRMultiple: 0,
    bestTrade: 0,
    worstTrade: 0,
    consecutiveWins: 0,
    consecutiveLosses: 0,
    accountBalance: 0,
};

export const GET = withAuth(async (request: NextRequest, _ctx: Record<string, unknown>, session: Session & { user: { id: string } }) => {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30';
    const periodDays = parseInt(period, 10);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    const userId = session.user.id;

    const allAccounts = await getAllUserAccounts(userId);
    const accountIds = allAccounts.map((a) => a.id);

    if (accountIds.length === 0) {
        return ok(emptyResponse);
    }

    const accountFilter = searchParams.get('account');
    const filteredIds = accountFilter && accountIds.includes(accountFilter) ? [accountFilter] : accountIds;

    const cacheKey = `dashboard:${userId}:${period}:${accountFilter ?? 'all'}`;
    const cached = cacheGet(cacheKey);
    if (cached) return ok(cached);

    const [trades, allClosedTrades, allTimeClosedTrades] = await Promise.all([
        prisma.trade.findMany({
            where: {
                accountId: { in: filteredIds },
                entryTime: { gte: startDate }
            },
            orderBy: { entryTime: 'desc' },
        }),
        prisma.trade.findMany({
            where: {
                accountId: { in: filteredIds },
                exitTime: { gte: startDate, not: null },
                pnl: { not: null },
            },
            orderBy: { exitTime: 'asc' },
            select: { exitTime: true, pnl: true, commission: true, swap: true },
        }),
        prisma.trade.findMany({
            where: {
                accountId: { in: filteredIds },
                exitTime: { not: null },
                pnl: { not: null },
            },
            orderBy: { exitTime: 'asc' },
            select: { exitTime: true, pnl: true, commission: true, swap: true },
        }),
    ]);

    let equityData: { time: string; value: number }[] = [];

    if (allClosedTrades.length > 0) {
        const byDay = new Map<string, number>();
        let running = 0;
        for (const t of allClosedTrades) {
            running += (t.pnl ?? 0) + (t.commission ?? 0) + (t.swap ?? 0);
            const key = t.exitTime!.toISOString().split('T')[0];
            byDay.set(key, running);
        }
        equityData = Array.from(byDay.entries())
            .map(([time, value]) => ({ time, value }))
            .sort((a, b) => a.time.localeCompare(b.time));
        const startKey = startDate.toISOString().split('T')[0];
        if (equityData[0]?.time !== startKey) {
            equityData.unshift({ time: startKey, value: 0 });
        }
    }

    let allTimeEquityData: { time: string; value: number }[] = [];

    if (allTimeClosedTrades.length > 0) {
        const byDay = new Map<string, number>();
        let running = 0;
        for (const t of allTimeClosedTrades) {
            running += (t.pnl ?? 0) + (t.commission ?? 0) + (t.swap ?? 0);
            const key = t.exitTime!.toISOString().split('T')[0];
            byDay.set(key, running);
        }
        allTimeEquityData = Array.from(byDay.entries())
            .map(([time, value]) => ({ time, value }))
            .sort((a, b) => a.time.localeCompare(b.time));
        const firstDate = allTimeClosedTrades[0]?.exitTime?.toISOString().split('T')[0];
        if (firstDate && allTimeEquityData[0]?.time !== firstDate) {
            allTimeEquityData.unshift({ time: firstDate, value: 0 });
        }
    }

    const closedTrades = trades.filter(t => t.exitTime && t.pnl !== null);
    const wins = closedTrades.filter(t => (t.pnl ?? 0) > 0);
    const losses = closedTrades.filter(t => (t.pnl ?? 0) < 0);

    const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl ?? 0) + (t.commission ?? 0) + (t.swap ?? 0), 0);

    const winRate = closedTrades.length > 0 ? Math.round((wins.length / closedTrades.length) * 100) : 0;
    const profitFactor = calculateProfitFactorFromTrades(closedTrades.map(t => ({ pnl: t.pnl ?? 0 })));

    const expectancy = closedTrades.length > 0 ? totalPnl / closedTrades.length : 0;

    const sortedByExit = [...closedTrades].sort((a, b) =>
        (a.exitTime?.getTime() ?? 0) - (b.exitTime?.getTime() ?? 0)
    );
    const maxDrawdown = calculateMaxDrawdownPercent(sortedByExit.map(t => t.pnl ?? 0));

    const pnls = closedTrades.map(t => t.pnl ?? 0);
    const bestTrade = pnls.length > 0 ? Math.max(...pnls) : 0;
    const worstTrade = pnls.length > 0 ? Math.abs(Math.min(...pnls)) : 0;

    let avgDurationMinutes = 0;
    const tradesWithDuration = closedTrades.filter(t => t.entryTime && t.exitTime);
    if (tradesWithDuration.length > 0) {
        const totalMinutes = tradesWithDuration.reduce((sum, t) => {
            const duration = (t.exitTime!.getTime() - t.entryTime.getTime()) / (1000 * 60);
            return sum + duration;
        }, 0);
        avgDurationMinutes = totalMinutes / tradesWithDuration.length;
    }

    const tradesWithRR = closedTrades.filter(t => t.rMultiple != null);
    let avgRMultiple = 0;
    if (tradesWithRR.length > 0) {
        avgRMultiple = tradesWithRR.reduce((sum, t) => sum + (t.rMultiple ?? 0), 0) / tradesWithRR.length;
    }

    let consecutiveWins = 0;
    let consecutiveLosses = 0;
    let currentWinStreak = 0;
    let currentLossStreak = 0;
    let maxWinStreak = 0;
    let maxLossStreak = 0;

    for (const t of sortedByExit) {
        const pnl = t.pnl ?? 0;
        if (pnl > 0) {
            currentWinStreak++;
            currentLossStreak = 0;
            maxWinStreak = Math.max(maxWinStreak, currentWinStreak);
        } else if (pnl < 0) {
            currentLossStreak++;
            currentWinStreak = 0;
            maxLossStreak = Math.max(maxLossStreak, currentLossStreak);
        }
    }
    consecutiveWins = maxWinStreak;
    consecutiveLosses = maxLossStreak;

    const recent = await prisma.trade.findMany({
        where: { accountId: { in: filteredIds } },
        orderBy: { entryTime: 'desc' },
        take: 5,
    });

    const recentTrades = recent.map(t => ({
        id: t.id,
        symbol: t.symbol,
        direction: t.direction,
        price: t.entryPrice.toString(),
        pnl: t.pnl ?? 0,
        time: formatDistanceToNow(t.entryTime),
        isActive: !t.exitTime,
    }));

    const calendarRaw = await prisma.$queryRaw<{ date: string; pnl: number; count: number; wins: number; losses: number; avg_rr: number | null }[]>`
      SELECT
        TO_CHAR("exitTime" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
        SUM(pnl)::float AS pnl,
        COUNT(*)::int AS count,
        COUNT(*) FILTER (WHERE pnl > 0)::int AS wins,
        COUNT(*) FILTER (WHERE pnl < 0)::int AS losses,
        AVG("rMultiple") FILTER (WHERE "rMultiple" IS NOT NULL)::float AS avg_rr
      FROM "Trade"
      WHERE "accountId" = ANY(${filteredIds}::text[])
        AND "exitTime" IS NOT NULL
        AND pnl IS NOT NULL
      GROUP BY TO_CHAR("exitTime" AT TIME ZONE 'UTC', 'YYYY-MM-DD')
      ORDER BY date DESC
    `;

    const calendarMap: Record<string, { pnl: number; count: number; wins: number; losses: number; avgRR: number | null }> = {};
    for (const row of calendarRaw) {
        calendarMap[row.date] = { pnl: row.pnl, count: row.count, wins: row.wins, losses: row.losses, avgRR: row.avg_rr ?? null };
    }
    const calendarData = Object.entries(calendarMap).map(([date, data]) => ({
        date,
        pnl: data.pnl,
        trades: data.count,
        wins: data.wins,
        losses: data.losses,
        avgRR: data.avgRR,
    }));

    const accountBalance = allAccounts.length > 0
        ? allAccounts.reduce((sum, acc) => sum + (acc.currentBalance ?? acc.balance ?? acc.accountSize ?? 0), 0)
        : 0;

    const responseData = {
        equity: equityData,
        allTimeEquity: allTimeEquityData,
        trades: recentTrades,
        calendar: calendarData,
        winRate,
        profitFactor,
        totalTrades: closedTrades.length,
        totalPnl,
        expectancy,
        maxDrawdown,
        avgRMultiple,
        bestTrade,
        worstTrade,
        consecutiveWins,
        consecutiveLosses,
        avgDurationMinutes,
        accountBalance,
    };

    cacheSet(cacheKey, responseData, 60_000);
    return ok(responseData);
});

export const runtime = 'nodejs';
