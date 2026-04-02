/**
 * Symbol Analytics API
 *
 * GET /api/analytics/symbols
 * Returns per-symbol breakdown of trading metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/api/withAuth';
import { ok } from '@/lib/api/responses';

interface SymbolMetrics {
    symbol: string;
    tradeCount: number;
    winCount: number;
    lossCount: number;
    winRate: number;
    totalPnl: number;
    avgPnl: number;
    avgRR: number;
    bestTrade: number;
    worstTrade: number;
    totalVolume: number;
    avgVolume: number;
    longCount: number;
    shortCount: number;
}

export const GET = withAuth(async (req: NextRequest, ctx, session) => {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get('accountId');

    // Build where clause
    const whereClause: Record<string, unknown> = {
        account: { userId: session.user.id },
        status: 'CLOSED',
        exitTime: { not: null },
    };

    if (accountId && accountId !== 'all') {
        whereClause.accountId = accountId;
    }

    // Fetch all closed trades with symbol info
    const trades = await prisma.trade.findMany({
        where: whereClause,
        select: {
            symbol: true,
            direction: true,
            pnl: true,
            rMultiple: true,
            volume: true,
        },
    });

    // Group trades by symbol
    const symbolMap = new Map<string, Array<{
        pnl: number | null;
        rMultiple: number | null;
        volume: number;
        direction: string;
    }>>();

    for (const trade of trades) {
        const symbol = trade.symbol;
        if (!symbolMap.has(symbol)) {
            symbolMap.set(symbol, []);
        }
        symbolMap.get(symbol)!.push({
            pnl: trade.pnl,
            rMultiple: trade.rMultiple,
            volume: trade.volume,
            direction: trade.direction,
        });
    }

    // Calculate metrics for each symbol
    const results: SymbolMetrics[] = [];

    for (const [symbol, symbolTrades] of symbolMap.entries()) {
        const pnls = symbolTrades.map(t => t.pnl ?? 0);
        const rMultiples = symbolTrades.map(t => t.rMultiple ?? 0).filter(r => r !== 0);
        const volumes = symbolTrades.map(t => t.volume);

        const totalPnl = pnls.reduce((sum, p) => sum + p, 0);
        const wins = pnls.filter(p => p > 0);
        const losses = pnls.filter(p => p < 0);
        const totalVolume = volumes.reduce((sum, v) => sum + v, 0);
        const longCount = symbolTrades.filter(t => t.direction === 'LONG').length;
        const shortCount = symbolTrades.filter(t => t.direction === 'SHORT').length;

        results.push({
            symbol,
            tradeCount: symbolTrades.length,
            winCount: wins.length,
            lossCount: losses.length,
            winRate: (wins.length / symbolTrades.length) * 100,
            totalPnl,
            avgPnl: totalPnl / symbolTrades.length,
            avgRR: rMultiples.length > 0 ? rMultiples.reduce((sum, r) => sum + r, 0) / rMultiples.length : 0,
            bestTrade: Math.max(...pnls),
            worstTrade: Math.min(...pnls),
            totalVolume,
            avgVolume: totalVolume / symbolTrades.length,
            longCount,
            shortCount,
        });
    }

    // Sort by total P&L descending
    results.sort((a, b) => b.totalPnl - a.totalPnl);

    return ok(results);
});