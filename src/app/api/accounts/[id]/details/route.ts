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

    // Parse phases config from prop firm
    let phasesConfig = null;
    if (account.propFirm?.phasesConfig) {
        try {
            phasesConfig = JSON.parse(account.propFirm.phasesConfig);
        } catch {
            // Ignore parse errors
        }
    }

    const response = ok({
        account: {
            ...account,
            tradeCount: account._count?.trades ?? 0,
            closedTradeCount: stats._count,
            totalPnl: stats._sum?.pnl ?? 0,
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
