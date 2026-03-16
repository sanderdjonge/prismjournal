import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { getAllUserAccounts } from '@/lib/getAccount';
import { calculateProfitFactor } from '@/lib/analytics';
import { formatDistanceToNow } from '@/lib/formatTime';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30';
    const periodDays = parseInt(period, 10);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
        return NextResponse.json({
            equity: [],
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
        });
    }

    const allAccounts = await getAllUserAccounts(userId);
    const accountIds = allAccounts.map((a) => a.id);

    if (accountIds.length === 0) {
        return NextResponse.json({
            equity: [],
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
        });
    }

    const accountFilter = searchParams.get('account');
    const filteredIds = accountFilter && accountIds.includes(accountFilter) ? [accountFilter] : accountIds;

    const [trades, snapshots, allClosedTrades] = await Promise.all([
        prisma.trade.findMany({
            where: {
                accountId: { in: filteredIds },
                entryTime: { gte: startDate }
            },
            orderBy: { entryTime: 'desc' },
        }),
        prisma.equitySnapshot.findMany({
            where: {
                accountId: { in: filteredIds },
                timestamp: { gte: startDate }
            },
            orderBy: { timestamp: 'asc' },
        }),
        // Get ALL closed trades for equity curve (not just period)
        prisma.trade.findMany({
            where: {
                accountId: { in: filteredIds },
                exitTime: { not: null },
                pnl: { not: null },
            },
            orderBy: { exitTime: 'asc' },
            select: { exitTime: true, pnl: true },
        }),
    ]);

    // --- Equity curve ---
    // Build from ALL closed trades, not just period trades
    let equityData: { time: string; value: number }[] = [];
    
    if (allClosedTrades.length > 0) {
        // Build equity curve from cumulative P&L by day
        const byDay = new Map<string, number>();
        let running = 0;
        for (const t of allClosedTrades) {
            running += t.pnl ?? 0;
            const key = t.exitTime!.toISOString().split('T')[0];
            byDay.set(key, running);
        }
        equityData = Array.from(byDay.entries())
            .map(([time, value]) => ({ time, value }))
            .sort((a, b) => a.time.localeCompare(b.time));
    }

    // --- Win rate & profit factor ---
    const closedTrades = trades.filter(t => t.exitTime && t.pnl !== null);
    const wins = closedTrades.filter(t => (t.pnl ?? 0) > 0);
    const losses = closedTrades.filter(t => (t.pnl ?? 0) < 0);

    // --- Total P&L ---
    const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);

    const winRate = closedTrades.length > 0 ? Math.round((wins.length / closedTrades.length) * 100) : 0;
    const profitFactor = calculateProfitFactor(closedTrades.map(t => ({ pnl: t.pnl ?? 0 })));

    // --- Expectancy (average $ per trade) ---
    const expectancy = closedTrades.length > 0 ? totalPnl / closedTrades.length : 0;

    // --- Max Drawdown ---
    let maxDrawdown = 0;
    let peak = 0;
    let runningPnl = 0;
    const sortedByExit = [...closedTrades].sort((a, b) => 
        (a.exitTime?.getTime() ?? 0) - (b.exitTime?.getTime() ?? 0)
    );
    for (const t of sortedByExit) {
        runningPnl += t.pnl ?? 0;
        if (runningPnl > peak) peak = runningPnl;
        const drawdown = peak - runningPnl;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    // --- Best & Worst Trade ---
    const pnls = closedTrades.map(t => t.pnl ?? 0);
    const bestTrade = pnls.length > 0 ? Math.max(...pnls) : 0;
    const worstTrade = pnls.length > 0 ? Math.abs(Math.min(...pnls)) : 0;

    // --- Average Duration ---
    let avgDurationMinutes = 0;
    const tradesWithDuration = closedTrades.filter(t => t.entryTime && t.exitTime);
    if (tradesWithDuration.length > 0) {
        const totalMinutes = tradesWithDuration.reduce((sum, t) => {
            const duration = (t.exitTime!.getTime() - t.entryTime.getTime()) / (1000 * 60);
            return sum + duration;
        }, 0);
        avgDurationMinutes = totalMinutes / tradesWithDuration.length;
    }

    // --- Average R-Multiple ---
    const tradesWithRR = closedTrades.filter(t => t.stopLoss && t.entryPrice);
    let avgRMultiple = 0;
    if (tradesWithRR.length > 0) {
        const rMultiples = tradesWithRR.map(t => {
            const risk = Math.abs(t.entryPrice - (t.stopLoss ?? 0));
            if (risk === 0) return 0;
            return (t.pnl ?? 0) / risk;
        });
        avgRMultiple = rMultiples.reduce((a, b) => a + b, 0) / rMultiples.length;
    }

    // --- Consecutive Wins/Losses ---
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

    // --- Recent trades (last 5, formatted for RecentTrades component) ---
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

    // --- Calendar data (trades by EXIT date for current month) ---
    const calendarTrades = await prisma.trade.findMany({
        where: {
            accountId: { in: filteredIds },
            exitTime: { not: null },
            pnl: { not: null },
        },
        orderBy: { exitTime: 'desc' },
        select: { exitTime: true, pnl: true },
    });

    // Aggregate P&L, trades, wins, losses per day by EXIT date
    const calendarMap = new Map<string, { pnl: number; trades: number; wins: number; losses: number }>();
    for (const t of calendarTrades) {
        const date = t.exitTime!.toISOString().split('T')[0];
        const existing = calendarMap.get(date) ?? { pnl: 0, trades: 0, wins: 0, losses: 0 };
        existing.pnl += t.pnl ?? 0;
        existing.trades += 1;
        if ((t.pnl ?? 0) > 0) existing.wins += 1;
        else if ((t.pnl ?? 0) < 0) existing.losses += 1;
        calendarMap.set(date, existing);
    }
    const calendarData = Array.from(calendarMap.entries()).map(([date, data]) => ({ 
        date, 
        pnl: data.pnl,
        trades: data.trades,
        wins: data.wins,
        losses: data.losses
    }));

    return NextResponse.json({
        equity: equityData,
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
    });
}

export const runtime = 'nodejs';
