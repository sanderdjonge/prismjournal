/**
 * Period Comparison API
 *
 * GET /api/analytics/compare
 * Compares metrics between two time periods
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/api/withAuth';
import { badRequest, ok } from '@/lib/api/responses';
import { calculateProfitFactor, serializeProfitFactor } from '@/lib/analytics';

interface ComparisonMetrics {
    profitFactor: number | null;
    winRate: number | null;
    totalPnl: number | null;
    totalTrades: number | null;
    avgRR: number | null;
    expectancy: number | null;
    bestTrade: number | null;
    worstTrade: number | null;
    avgTrade: number | null;
}

interface PeriodComparisonResult {
    period1: { start: string; end: string; label: string };
    period2: { start: string; end: string; label: string };
    metrics1: ComparisonMetrics;
    metrics2: ComparisonMetrics;
    delta: {
        profitFactor: number | null;
        winRate: number | null;
        totalPnl: number | null;
        totalTrades: number | null;
        avgRR: number | null;
        expectancy: number | null;
    };
}

/**
 * Calculate metrics for a set of trades
 */
function calculateMetrics(trades: Array<{ pnl: number | null; rMultiple: number | null }>): ComparisonMetrics {
    if (trades.length === 0) {
        return {
            profitFactor: null,
            winRate: null,
            totalPnl: null,
            totalTrades: 0,
            avgRR: null,
            expectancy: null,
            bestTrade: null,
            worstTrade: null,
            avgTrade: null,
        };
    }

    const pnls = trades.map(t => t.pnl ?? 0).filter(p => p !== 0);
    const rMultiples = trades.map(t => t.rMultiple ?? 0).filter(r => r !== 0);
    
    const totalPnl = pnls.reduce((sum, p) => sum + p, 0);
    const wins = pnls.filter(p => p > 0);
    const losses = pnls.filter(p => p < 0);
    const totalWins = wins.reduce((sum, p) => sum + p, 0);
    const totalLosses = Math.abs(losses.reduce((sum, p) => sum + p, 0));
    
    const profitFactor = calculateProfitFactor(totalWins, totalLosses);
    const winRate = trades.length > 0 ? (wins.length / trades.length) * 100 : 0;
    const avgRR = rMultiples.length > 0 ? rMultiples.reduce((sum, r) => sum + r, 0) / rMultiples.length : 0;
    const expectancy = trades.length > 0 ? totalPnl / trades.length : 0;
    const bestTrade = pnls.length > 0 ? Math.max(...pnls) : 0;
    const worstTrade = pnls.length > 0 ? Math.min(...pnls) : 0;
    const avgTrade = pnls.length > 0 ? totalPnl / pnls.length : 0;

    return {
        profitFactor: serializeProfitFactor(profitFactor),
        winRate,
        totalPnl,
        totalTrades: trades.length,
        avgRR,
        expectancy,
        bestTrade,
        worstTrade,
        avgTrade,
    };
}

/**
 * Calculate percentage delta between two values
 */
function calcDelta(val1: number | null, val2: number | null): number | null {
    if (val1 === null || val2 === null) return null;
    if (val2 === 0) return val1 > 0 ? 100 : 0;
    return ((val1 - val2) / Math.abs(val2)) * 100;
}

export const GET = withAuth(async (req: NextRequest, ctx, session) => {
    const { searchParams } = new URL(req.url);
    
    const period1Start = searchParams.get('period1Start');
    const period1End = searchParams.get('period1End');
    const period2Start = searchParams.get('period2Start');
    const period2End = searchParams.get('period2End');
    const accountId = searchParams.get('accountId');

    if (!period1Start || !period1End || !period2Start || !period2End) {
        return badRequest('Missing required period parameters');
    }

    const p1Start = new Date(period1Start);
    const p1End = new Date(period1End);
    const p2Start = new Date(period2Start);
    const p2End = new Date(period2End);

    // Build where clause
    const baseWhere: Record<string, unknown> = {
        account: { userId: session.user.id },
        status: 'CLOSED',
        exitTime: { not: null },
    };

    if (accountId && accountId !== 'all') {
        baseWhere.accountId = accountId;
    }

    // Fetch trades for both periods in parallel
    const [trades1, trades2] = await Promise.all([
        prisma.trade.findMany({
            where: {
                ...baseWhere,
                exitTime: {
                    gte: p1Start,
                    lte: p1End,
                },
            },
            select: {
                pnl: true,
                rMultiple: true,
            },
        }),
        prisma.trade.findMany({
            where: {
                ...baseWhere,
                exitTime: {
                    gte: p2Start,
                    lte: p2End,
                },
            },
            select: {
                pnl: true,
                rMultiple: true,
            },
        }),
    ]);

    const metrics1 = calculateMetrics(trades1);
    const metrics2 = calculateMetrics(trades2);

    const result: PeriodComparisonResult = {
        period1: { start: p1Start.toISOString(), end: p1End.toISOString(), label: 'Period 1' },
        period2: { start: p2Start.toISOString(), end: p2End.toISOString(), label: 'Period 2' },
        metrics1,
        metrics2,
        delta: {
            profitFactor: calcDelta(metrics1.profitFactor, metrics2.profitFactor),
            winRate: calcDelta(metrics1.winRate, metrics2.winRate),
            totalPnl: calcDelta(metrics1.totalPnl, metrics2.totalPnl),
            totalTrades: calcDelta(metrics1.totalTrades, metrics2.totalTrades),
            avgRR: calcDelta(metrics1.avgRR, metrics2.avgRR),
            expectancy: calcDelta(metrics1.expectancy, metrics2.expectancy),
        },
    };

    return ok(result);
});