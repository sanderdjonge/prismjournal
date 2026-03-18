import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAllUserAccounts } from '@/lib/getAccount';
import { calculateProfitFactor } from '@/lib/analytics';
import { withAuth } from '@/lib/api/withAuth';
import type { Session } from 'next-auth';

export const GET = withAuth(async (request: NextRequest, _ctx: Record<string, unknown>, session: Session & { user: { id: string } }) => {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const userId = session.user.id;

    const allAccounts = await getAllUserAccounts(userId);
    const accountIds = allAccounts.map((a) => a.id);

    if (accountIds.length === 0) {
        return NextResponse.json({
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

    // Build date filter
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
        return NextResponse.json({
            symbolData: [],
            expectancyData: [],
            sessionData: Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 })),
            profitFactor: 0,
            expectancy: 0,
            avgRR: 0,
            meanDrawdown: 0,
        });
    }

    // --- Symbol aggregation ---
    const symbolMap = new Map<string, { profit: number; wins: number; total: number }>();
    for (const t of trades) {
        const pnl = t.pnl ?? 0;
        const existing = symbolMap.get(t.symbol) ?? { profit: 0, wins: 0, total: 0 };
        symbolMap.set(t.symbol, {
            profit: existing.profit + pnl,
            wins: existing.wins + (pnl > 0 ? 1 : 0),
            total: existing.total + 1,
        });
    }
    const symbolData = Array.from(symbolMap.entries()).map(([symbol, d]) => ({
        symbol,
        profit: Math.round(d.profit),
        winRate: Math.round((d.wins / d.total) * 100),
    })).sort((a, b) => b.profit - a.profit);

    // --- Edge evolution (rolling average PnL) ---
    const expectancyData: { trade: number; val: number }[] = [];
    let runningSum = 0;
    trades.forEach((t, i) => {
        runningSum += t.pnl ?? 0;
        const avg = runningSum / (i + 1);
        expectancyData.push({ trade: i + 1, val: Math.round(avg * 100) / 100 });
    });
    // Downsample to max 20 points for chart performance
    const step = Math.max(1, Math.floor(expectancyData.length / 20));
    const sampledExpectancy = expectancyData.filter((_, i) => i % step === 0 || i === expectancyData.length - 1);

    // --- Session distribution (by entry hour) - ALL trades, not just closed with PnL ---
    const allTradesForHours = await prisma.trade.findMany({
        where: {
            accountId: { in: filteredIds },
            ...(Object.keys(dateFilter).length > 0 && { entryTime: dateFilter }),
        },
        select: { entryTime: true, pnl: true, exitTime: true },
    });

    const hourBuckets = Array.from({ length: 24 }, (_, h) => ({
        hour: h,
        count: 0,
        wins: 0,
        losses: 0,
        totalPnl: 0,
    }));

    for (const trade of allTradesForHours) {
        const h = trade.entryTime.getUTCHours();
        hourBuckets[h].count++;
        if (trade.pnl != null) {
            hourBuckets[h].totalPnl += trade.pnl;
            if (trade.pnl > 0) hourBuckets[h].wins++;
            else if (trade.pnl < 0) hourBuckets[h].losses++;
        }
    }

    // Return all 24 hours (chart expects full array)
    const sessionData = hourBuckets;

    // --- Key metrics ---
    const pnlValues = trades.map(t => ({ pnl: t.pnl ?? 0 }));
    const profitFactor = calculateProfitFactor(pnlValues);
    const netPnl = trades.reduce((s, t) => s + (t.pnl ?? 0), 0);
    const expectancy = trades.length > 0 ? Math.round((netPnl / trades.length) * 100) / 100 : 0;

    // Mean realized R:R from closed trades with entry, exit, and SL
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

    // Mean drawdown — simplistic: average of negative P&L trades as % of sum
    const losers = trades.filter(t => (t.pnl ?? 0) < 0);
    const meanDrawdown = losers.length > 0
        ? Math.round(Math.abs(losers.reduce((s, t) => s + (t.pnl ?? 0), 0) / losers.length) * 100) / 100
        : 0;

    return NextResponse.json({
        symbolData,
        expectancyData: sampledExpectancy,
        sessionData,
        profitFactor,
        expectancy,
        avgRR,
        meanDrawdown,
    });
});

export const runtime = 'nodejs';
