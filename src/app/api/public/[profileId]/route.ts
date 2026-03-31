import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ profileId: string }> }
) {
    try {
        const { profileId } = await params;

        // Find user by public profile ID
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
            return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
        }

        // Get stats
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
        const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;
        const winRate = closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : 0;

        // Build equity curve
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

        return NextResponse.json({
            profile: {
                id: profileId,
                name: user.name,
                stats: user.publicProfileStats,
                memberSince: user.createdAt,
            },
            performance: {
                totalTrades: closedTrades.length,
                winRate: winRate.toFixed(1),
                profitFactor: profitFactor === 999 ? '∞' : profitFactor.toFixed(2),
                totalPnl: totalPnl.toFixed(2),
                equityCurve,
            },
        });
    } catch (error) {
        console.error('[public-profile] Error:', error);
        return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
    }
}