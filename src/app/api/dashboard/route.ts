import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getDefaultAccount } from '@/lib/getAccount';
import { calculateProfitFactor } from '../../../../server/utils/analytics_compute';
import { formatDistanceToNow } from '@/lib/formatTime';

export async function GET() {
    const account = await getDefaultAccount();

    if (!account) {
        return NextResponse.json({
            equity: [],
            trades: [],
            winRate: 0,
            profitFactor: 0,
            totalTrades: 0,
        });
    }

    const [trades, snapshots] = await Promise.all([
        prisma.trade.findMany({
            where: { accountId: account.id, pnl: { not: null } },
            orderBy: { entryTime: 'desc' },
        }),
        prisma.equitySnapshot.findMany({
            where: { accountId: account.id },
            orderBy: { timestamp: 'asc' },
        }),
    ]);

    // --- Equity curve ---
    let equityData: { time: string; value: number }[] = [];

    if (snapshots.length >= 2) {
        // Group snapshots by day, take last snapshot of each day
        const byDay = new Map<string, number>();
        for (const s of snapshots) {
            const key = s.timestamp.toISOString().split('T')[0];
            byDay.set(key, s.equity);
        }
        equityData = Array.from(byDay.entries()).map(([time, value]) => ({ time, value }));
    } else if (trades.length > 0) {
        // Build equity curve from cumulative P&L by day
        const closedSorted = [...trades].filter(t => t.exitTime).sort((a, b) => a.entryTime.getTime() - b.entryTime.getTime());
        const byDay = new Map<string, number>();
        let running = 0;
        for (const t of closedSorted) {
            running += t.pnl ?? 0;
            const key = (t.exitTime ?? t.entryTime).toISOString().split('T')[0];
            byDay.set(key, running);
        }
        equityData = Array.from(byDay.entries()).map(([time, value]) => ({ time, value }));
    }

    // --- Win rate & profit factor ---
    const closedTrades = trades.filter(t => t.exitTime && t.pnl !== null);
    const wins = closedTrades.filter(t => (t.pnl ?? 0) > 0);
    const winRate = closedTrades.length > 0 ? Math.round((wins.length / closedTrades.length) * 100) : 0;
    const profitFactor = calculateProfitFactor(closedTrades.map(t => ({ pnl: t.pnl ?? 0 })));

    // --- Recent trades (last 5, formatted for RecentTrades component) ---
    const recent = await prisma.trade.findMany({
        where: { accountId: account.id },
        orderBy: { entryTime: 'desc' },
        take: 5,
    });

    const recentTrades = recent.map(t => ({
        id: t.id,
        symbol: t.symbol,
        type: t.direction === 'LONG' ? 'BUY' as const : 'SELL' as const,
        price: t.entryPrice.toString(),
        pnl: t.pnl ?? 0,
        time: formatDistanceToNow(t.entryTime),
        isActive: !t.exitTime,
    }));

    // --- Calendar data (trades with P&L for current month) ---
    const calendarTrades = await prisma.trade.findMany({
        where: {
            accountId: account.id,
            pnl: { not: null },
            exitTime: { not: null },
        },
        orderBy: { exitTime: 'desc' },
        select: { exitTime: true, pnl: true },
    });

    // Aggregate P&L per day
    const calendarMap = new Map<string, number>();
    for (const t of calendarTrades) {
        const date = t.exitTime!.toISOString().split('T')[0];
        calendarMap.set(date, (calendarMap.get(date) ?? 0) + (t.pnl ?? 0));
    }
    const calendarData = Array.from(calendarMap.entries()).map(([date, pnl]) => ({ date, pnl }));

    return NextResponse.json({
        equity: equityData,
        trades: recentTrades,
        calendar: calendarData,
        winRate,
        profitFactor,
        totalTrades: closedTrades.length,
    });
}

export const runtime = 'nodejs';
