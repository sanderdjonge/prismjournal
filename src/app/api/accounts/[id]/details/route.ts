import { withAuth } from '@/lib/api/withAuth';
import { ok, notFound } from '@/lib/api/responses';
import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const GET = withAuth(async (req, ctx, session) => {
    const userId = session.user.id;
    const { id: accountId } = await (ctx.params as Promise<{ id: string }>);

    const account = await prisma.tradingAccount.findFirst({
        where: { id: accountId, userId },
        include: {
            propFirm: {
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    challengeType: true,
                    dailyLossLimit: true,
                    maxDrawdown: true,
                    drawdownType: true,
                    phasesConfig: true,
                    allowNewsTrading: true,
                    allowWeekendHolding: true,
                    allowEA: true,
                    hasScalingPlan: true,
                    scalingConfig: true,
                },
            },
            challengePhases: {
                orderBy: { phaseNumber: 'asc' },
            },
            violations: {
                orderBy: { occurredAt: 'desc' },
                take: 20,
            },
            _count: { select: { trades: true } },
        },
    });

    if (!account) {
        return notFound('Account not found');
    }

    // Get trade statistics
    const stats = await prisma.trade.aggregate({
        where: { accountId: account.id, status: 'CLOSED' },
        _sum: { pnl: true },
        _count: true,
    });

    // Today's P&L (for live daily loss calculation when no snapshot exists)
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayStats = await prisma.trade.aggregate({
        where: { accountId: account.id, exitTime: { gte: todayStart }, pnl: { not: null } },
        _sum: { pnl: true },
    });
    const todayPnl = todayStats._sum?.pnl ?? 0;

    // Get latest daily snapshot if exists
    let latestSnapshot = null;
    try {
        latestSnapshot = await prisma.dailyAccountSnapshot.findFirst({
            where: { accountId: account.id },
            orderBy: { snapshotDate: 'desc' },
        });
    } catch {
        // Table might not exist yet
    }

    // phasesConfig is already parsed by Prisma (Json type)
    const phasesConfig = account.propFirm?.phasesConfig ?? null;

    const response = ok({
        account: {
            ...account,
            tradeCount: account._count?.trades ?? 0,
            closedTradeCount: stats._count,
            totalPnl: stats._sum?.pnl ?? 0,
            todayPnl,
            phasesConfig,
            latestSnapshot,
        },
    });
    
    // Add cache control headers to prevent caching
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;
});
