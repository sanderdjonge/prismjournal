import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getDefaultAccount } from '@/lib/getAccount';
import { calculateProfitFactor } from '../../../../server/utils/analytics_compute';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30';
    const periodDays = parseInt(period, 10);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    const account = await getDefaultAccount();

    if (!account) {
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
        });
    }

    const [trades, snapshots, allClosedTrades] = await Promise.all([
        prisma.trade.findMany({
            where: { 
                accountId: account.id, 
                pnl: { not: null }, 
                exitTime: { not: null },
                entryTime: { gte: startDate }
            },
            orderBy: { entryTime: 'asc' },
        }),
        prisma.equitySnapshot.findMany({
            where: { accountId: account.id },
            orderBy: { timestamp: 'asc' },
        }),
        // Get ALL closed trades for equity curve (not just period)
        prisma.trade.findMany({
            where: { 
                accountId: account.id, 
                pnl: { not: null }, 
                exitTime: { not: null }
            },
            orderBy: { exitTime: 'asc' },
            select: { exitTime: true, pnl: true },
        }),
    ]);

    // --- Equity curve (from ALL closed trades, not just period) ---
    let equityData: { time: string; value: number }[] = [];
    if (allClosedTrades.length > 0) {
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
    } else if (snapshots.length >= 2) {
        const byDay = new Map<string, number>();
        for (const s of snapshots) {
            const key = s.timestamp.toISOString().split('T')[0];
            byDay.set(key, s.equity);
        }
        equityData = Array.from(byDay.entries()).map(([time, value]) => ({ time, value }));
    }

    // --- Key stats ---
    const pnlList = trades.map(t => t.pnl ?? 0);
    const netPnl = pnlList.reduce((a, b) => a + b, 0);
    const profitFactor = calculateProfitFactor(trades.map(t => ({ pnl: t.pnl ?? 0 })));

    const winners = pnlList.filter(p => p > 0);
    const losers = pnlList.filter(p => p < 0);
    const avgWin = winners.length > 0 ? winners.reduce((a, b) => a + b, 0) / winners.length : 0;
    const avgLoss = losers.length > 0 ? Math.abs(losers.reduce((a, b) => a + b, 0) / losers.length) : 0;
    const expectancy = trades.length > 0 ? netPnl / trades.length : 0;

    // Max drawdown from equity curve (balance-based)
    const latestSnap = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
    const accountBalance = latestSnap?.balance ?? 10000;
    let peak = accountBalance;
    let running = accountBalance;
    let maxDrawdown = 0;
    for (const pnl of pnlList) {
        running += pnl;
        if (running > peak) peak = running;
        const dd = peak > 0 ? ((peak - running) / peak) * 100 : 0;
        if (dd > maxDrawdown) maxDrawdown = dd;
    }

    // Sharpe ratio (monthly returns)
    const monthlyMap = new Map<string, number>();
    for (const t of trades) {
        const key = `${t.entryTime.getFullYear()}-${t.entryTime.getMonth()}`;
        monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + (t.pnl ?? 0));
    }
    const monthlyReturns = Array.from(monthlyMap.values());
    let sharpe = 0;
    if (monthlyReturns.length >= 2) {
        const mean = monthlyReturns.reduce((a, b) => a + b, 0) / monthlyReturns.length;
        const variance = monthlyReturns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / monthlyReturns.length;
        const stdDev = Math.sqrt(variance);
        sharpe = stdDev > 0 ? Math.round((mean / stdDev) * Math.sqrt(12) * 100) / 100 : 0;
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
    const base = latestSnapshot?.balance ?? 10000;
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
    });
}

export const runtime = 'nodejs';
