import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getAllUserAccounts } from '@/lib/getAccount';
import { calculateProfitFactorFromTrades, calculateWinRatePercent } from '@/lib/analytics';
import { withAuth } from '@/lib/api/withAuth';
import { cacheGet, cacheSet } from '@/lib/api/cache';
import { normaliseBrokerSymbol } from '@/lib/symbol-normaliser';
import { ok } from '@/lib/api/responses';
import type { Session } from 'next-auth';

export const GET = withAuth(async (request: NextRequest, _ctx: Record<string, unknown>, session: Session & { user: { id: string } }) => {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const userId = session.user.id;

    const allAccounts = await getAllUserAccounts(userId);
    const accountIds = allAccounts.map((a) => a.id);

    if (accountIds.length === 0) {
        return ok({
            symbolData: [],
            expectancyData: [],
            sessionData: Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 })),
            profitFactor: 0,
            expectancy: 0,
            avgRR: 0,
            meanDrawdown: 0,
        });
    }

    const accountFilter = searchParams.get('account');
    const filteredIds = accountFilter && accountIds.includes(accountFilter) ? [accountFilter] : accountIds;

    const cacheKey = `analytics:${userId}:${from ?? ''}:${to ?? ''}:${accountFilter ?? 'all'}`;
    const cached = cacheGet(cacheKey);
    if (cached) return ok(cached);

    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) dateFilter.lte = new Date(to);

    const trades = await prisma.trade.findMany({
        where: {
            accountId: { in: filteredIds },
            pnl: { not: null },
            exitTime: { not: null },
            ...(Object.keys(dateFilter).length > 0 && { entryTime: dateFilter }),
        },
        orderBy: { entryTime: 'asc' },
    });

    if (trades.length === 0) {
        return ok({
            symbolData: [],
            expectancyData: [],
            sessionData: Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 })),
            profitFactor: 0,
            expectancy: 0,
            avgRR: 0,
            meanDrawdown: 0,
        });
    }

    const symbolMap = new Map<string, { profit: number; wins: number; total: number }>();
    for (const t of trades) {
        const pnl = t.pnl ?? 0;
        const normalizedSymbol = normaliseBrokerSymbol(t.symbol);
        const existing = symbolMap.get(normalizedSymbol) ?? { profit: 0, wins: 0, total: 0 };
        symbolMap.set(normalizedSymbol, {
            profit: existing.profit + pnl,
            wins: existing.wins + (pnl > 0 ? 1 : 0),
            total: existing.total + 1,
        });
    }
    const symbolData = Array.from(symbolMap.entries()).map(([symbol, d]) => ({
        symbol,
        profit: Math.round(d.profit),
        winRate: calculateWinRatePercent(d.wins, d.total),
    })).sort((a, b) => b.profit - a.profit);

    const expectancyData: { trade: number; val: number }[] = [];
    let runningSum = 0;
    trades.forEach((t, i) => {
        runningSum += t.pnl ?? 0;
        const avg = runningSum / (i + 1);
        expectancyData.push({ trade: i + 1, val: Math.round(avg * 100) / 100 });
    });
    const step = Math.max(1, Math.floor(expectancyData.length / 20));
    const sampledExpectancy = expectancyData.filter((_, i) => i % step === 0 || i === expectancyData.length - 1);

    const allTradesForHours = await prisma.trade.findMany({
        where: {
            accountId: { in: filteredIds },
            ...(Object.keys(dateFilter).length > 0 && { entryTime: dateFilter }),
        },
        select: { entryTime: true, pnl: true, exitTime: true, rMultiple: true },
    });

    const hourBuckets = Array.from({ length: 24 }, (_, h) => ({
        hour: h,
        count: 0,
        wins: 0,
        losses: 0,
        totalPnl: 0,
        totalRR: 0,
        rrCount: 0,
    }));

    for (const trade of allTradesForHours) {
        const h = trade.entryTime.getUTCHours();
        hourBuckets[h].count++;
        if (trade.pnl != null) {
            hourBuckets[h].totalPnl += trade.pnl;
            if (trade.pnl > 0) hourBuckets[h].wins++;
            else if (trade.pnl < 0) hourBuckets[h].losses++;
        }
        if (trade.rMultiple != null) {
            hourBuckets[h].totalRR += trade.rMultiple;
            hourBuckets[h].rrCount++;
        }
    }

    const sessionData = hourBuckets.map(h => ({
        hour: h.hour,
        count: h.count,
        wins: h.wins,
        losses: h.losses,
        totalPnl: Math.round(h.totalPnl * 100) / 100,
        winRate: h.count > 0 ? calculateWinRatePercent(h.wins, h.count) : 0,
        avgRR: h.rrCount > 0 ? Math.round((h.totalRR / h.rrCount) * 100) / 100 : 0,
    }));

    const pnlValues = trades.map(t => ({ pnl: t.pnl ?? 0 }));
    const profitFactor = calculateProfitFactorFromTrades(pnlValues);
    const totalPnl = trades.reduce((s, t) => s + (t.pnl ?? 0), 0);
    const expectancy = trades.length > 0 ? Math.round((totalPnl / trades.length) * 100) / 100 : 0;

    const rrTrades = trades.filter(t => t.entryPrice && t.exitPrice && t.stopLoss && t.stopLoss !== 0);
    let avgRR = 0;
    if (rrTrades.length > 0) {
        let totalRR = 0;
        for (const t of rrTrades) {
            const risk = Math.abs(t.entryPrice - t.stopLoss!);
            if (risk === 0) continue;
            const reward = Math.abs(t.exitPrice! - t.entryPrice);
            totalRR += reward / risk;
        }
        avgRR = Math.round((totalRR / rrTrades.length) * 100) / 100;
    }

    const losers = trades.filter(t => (t.pnl ?? 0) < 0);
    const meanDrawdown = losers.length > 0
        ? Math.round(Math.abs(losers.reduce((s, t) => s + (t.pnl ?? 0), 0) / losers.length) * 100) / 100
        : 0;

    const responseData = {
        symbolData,
        expectancyData: sampledExpectancy,
        sessionData,
        profitFactor,
        expectancy,
        avgRR,
        meanDrawdown,
    };

    cacheSet(cacheKey, responseData, 5 * 60_000);
    return ok(responseData);
});

export const runtime = 'nodejs';
