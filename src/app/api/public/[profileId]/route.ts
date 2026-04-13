import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { calculateProfitFactor, formatProfitFactor } from '@/lib/analytics';
import { ok, notFound, internalError } from '@/lib/api/responses';
import logger from '@/lib/logger';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ profileId: string }> }
) {
    try {
        const { profileId } = await params;

        const user = await prisma.user.findFirst({
            where: {
                publicProfileId: profileId,
                publicProfileEnabled: true,
            },
            select: {
                id: true,
                name: true,
                publicProfileStats: true,
                createdAt: true,
            },
        });

        if (!user) {
            return notFound('Profile');
        }

        const trades = await prisma.trade.findMany({
            where: {
                account: { userId: user.id },
                exitTime: { not: null },
                pnl: { not: null },
            },
            select: {
                pnl: true,
                exitTime: true,
            },
        });

        const closedTrades = trades.filter(t => t.pnl !== null && t.exitTime !== null);
        const wins = closedTrades.filter(t => (t.pnl ?? 0) > 0);
        const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
        const grossProfit = wins.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
        const grossLoss = Math.abs(closedTrades.filter(t => (t.pnl ?? 0) < 0).reduce((sum, t) => sum + (t.pnl ?? 0), 0));
        const profitFactor = calculateProfitFactor(grossProfit, grossLoss);
        const winRate = closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : 0;

        const startingValue = 10000;
        let runningPnl = 0;
        const sortedTrades = [...closedTrades].sort((a, b) =>
            new Date(a.exitTime!).getTime() - new Date(b.exitTime!).getTime()
        );
        const equityCurve = sortedTrades.slice(-30).map(t => {
            runningPnl += t.pnl ?? 0;
            return {
                date: new Date(t.exitTime!).toISOString().split('T')[0],
                value: startingValue + runningPnl,
            };
        });

        return ok({
            profile: {
                id: profileId,
                name: user.name,
                stats: user.publicProfileStats,
                memberSince: user.createdAt,
            },
            performance: {
                totalTrades: closedTrades.length,
                winRate: winRate.toFixed(1),
                profitFactor: formatProfitFactor(profitFactor),
                totalPnl: totalPnl.toFixed(2),
                equityCurve,
            },
        });
    } catch (error) {
        logger.error({ err: error }, '[public-profile] Error');
        return internalError();
    }
}
