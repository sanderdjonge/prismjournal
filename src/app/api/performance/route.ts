import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAllUserAccounts } from '@/lib/getAccount';
import { calculateProfitFactor } from '@/lib/analytics';
import { withAuth } from '@/lib/api/withAuth';
import type { Session } from 'next-auth';

export const GET = withAuth(async (request: NextRequest, ctx: Record<string, unknown>, session: Session & { user: { id: string } }) => {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30';
    const accountId = searchParams.get('accountId'); // null = all accounts
    const periodDays = parseInt(period, 10);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    const userId = session.user.id;

    // Determine which accounts to query
    let accountIds: string[] = [];
    
    if (accountId && accountId !== 'all') {
        // Specific account
        accountIds = [accountId];
    } else {
        // All accounts for user
        const accounts = await getAllUserAccounts(userId);
        accountIds = accounts.map((a: { id: string }) => a.id);
    }

    if (accountIds.length === 0) {
        return NextResponse.json({
            equity: [],
            netPnl: 0,
            maxDrawdown: 0,
            sharpe: 0,
            profitFactor: 0,
            avgWin: 0,
            avgLoss: 0,
            expectancy: 0,
            monthlyReturns: [],
            accountCount: 0,
        });
    }

    const [trades, snapshots, allClosedTrades] = await Promise.all([
        prisma.trade.findMany({
            where: { 
                accountId: { in: accountIds }, 
                pnl: { not: null }, 
                exitTime: { not: null },
                entryTime: { gte: startDate }
            },
            orderBy: { entryTime: 'asc' },
        }),
        prisma.equitySnapshot.findMany({
            where: { accountId: { in: accountIds } },
            orderBy: { timestamp: 'asc' },
        }),
        // Get closed trades from startDate for equity curve
        prisma.trade.findMany({
            where: {
                accountId: { in: accountIds },
                pnl: { not: null },
                exitTime: { gte: startDate, not: null },
            },
            orderBy: { exitTime: 'asc' },
            select: { exitTime: true, pnl: true, commission: true, swap: true },
        }),
    ]);

    // --- Equity curve (from ALL closed trades, not just period) ---
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
        // Prepend zero anchor at period start so curve visually starts at 0
        const startKey = startDate.toISOString().split('T')[0];
        if (equityData[0]?.time !== startKey) {
            equityData.unshift({ time: startKey, value: 0 });
        }
    } else if (snapshots.length >= 2) {
        const byDay = new Map<string, number>();
        for (const s of snapshots) {
            const key = s.timestamp.toISOString().split('T')[0];
            byDay.set(key, s.equity);
        }
        equityData = Array.from(byDay.entries()).map(([time, value]) => ({ time, value }));
    }

    // --- Key stats (net PnL: gross profit + commission + swap) ---
    const pnlList = trades.map(t => (t.pnl ?? 0) + (t.commission ?? 0) + (t.swap ?? 0));
    const netPnl = pnlList.reduce((a, b) => a + b, 0);
    const profitFactor = calculateProfitFactor(trades.map(t => ({ pnl: t.pnl ?? 0 })));

    const winners = pnlList.filter(p => p > 0);
    const losers = pnlList.filter(p => p < 0);
    const avgWin = winners.length > 0 ? winners.reduce((a, b) => a + b, 0) / winners.length : 0;
    const avgLoss = losers.length > 0 ? Math.abs(losers.reduce((a, b) => a + b, 0) / losers.length) : 0;
    const expectancy = trades.length > 0 ? netPnl / trades.length : 0;

    // Max drawdown from equity curve (balance-based)
    const latestSnap = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
    const accountBalance = latestSnap?.balance ?? 0;
    let peak = accountBalance;
    let running = accountBalance;
    let maxDrawdown = 0;
    for (const pnl of pnlList) {
        running += pnl;
        if (running > peak) peak = running;
        const dd = peak > 0 ? ((peak - running) / peak) * 100 : 0;
        if (dd > maxDrawdown) maxDrawdown = dd;
    }

    // Sharpe ratio (monthly returns) - returns null when insufficient data
    const monthlyMap = new Map<string, number>();
    for (const t of trades) {
        const key = `${t.entryTime.getFullYear()}-${t.entryTime.getMonth()}`;
        monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + (t.pnl ?? 0));
    }
    const monthlyReturns = Array.from(monthlyMap.values());
    let sharpe: number | null = null;
    if (monthlyReturns.length >= 2) {
        const mean = monthlyReturns.reduce((a, b) => a + b, 0) / monthlyReturns.length;
        const variance = monthlyReturns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / monthlyReturns.length;
        const stdDev = Math.sqrt(variance);
        if (stdDev > 0) {
            sharpe = Math.round((mean / stdDev) * Math.sqrt(12) * 100) / 100;
        }
    }

    // Monthly return matrix (current year, percentage)
    const currentYear = new Date().getFullYear();
    const yearTrades = trades.filter(t => t.entryTime.getFullYear() === currentYear);
    const monthlyPnl = Array(12).fill(0);
    for (const t of yearTrades) {
        monthlyPnl[t.entryTime.getMonth()] += t.pnl ?? 0;
    }

    // Use latest snapshot balance as base, or fallback to account balance
    const latestSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
    const base = latestSnapshot?.balance ?? 0;
    const monthlyReturnsPct = monthlyPnl.map((pnl, i) => ({
        month: i,
        value: base > 0 ? Math.round((pnl / base) * 100 * 10) / 10 : 0,
    }));

    return NextResponse.json({
        equity: equityData,
        netPnl: Math.round(netPnl * 100) / 100,
        maxDrawdown: Math.round(maxDrawdown * 100) / 100,
        sharpe,
        profitFactor,
        avgWin: Math.round(avgWin * 100) / 100,
        avgLoss: Math.round(avgLoss * 100) / 100,
        expectancy: Math.round(expectancy * 100) / 100,
        monthlyReturns: monthlyReturnsPct,
        accountCount: accountIds.length,
    });
});

export const runtime = 'nodejs';
