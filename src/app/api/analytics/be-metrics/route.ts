import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getAllUserAccounts } from '@/lib/getAccount';
import { withAuth } from '@/lib/api/withAuth';
import type { Session } from 'next-auth';
import { ok } from '@/lib/api/responses';

export const GET = withAuth(async (request: NextRequest, _ctx: Record<string, unknown>, session: Session & { user: { id: string } }) => {
    const { searchParams } = new URL(request.url);
    const userId = session.user.id;

    const allAccounts = await getAllUserAccounts(userId);
    const accountIds = allAccounts.map((a) => a.id);

    if (accountIds.length === 0) {
        return ok({
            beProtectionRate: 0,
            beStopOutRate: 0,
            avgRCaptured: 0,
            avgRPotential: 0,
            rEfficiency: 0,
            tradeCount: 0,
        });
    }

    const accountFilter = searchParams.get('accountId');
    const filteredIds = accountFilter && accountIds.includes(accountFilter) ? [accountFilter] : accountIds;

    const trades = await prisma.trade.findMany({
        where: {
            accountId: { in: filteredIds },
            status: 'CLOSED',
            initialStopLoss: { not: null },
        },
        select: {
            beTriggered: true,
            pnl: true,
            rMultiple: true,
            takeProfit: true,
            entryPrice: true,
            initialStopLoss: true,
            direction: true,
        },
    });

    const tradeCount = trades.length;

    if (tradeCount === 0) {
        return ok({
            beProtectionRate: 0,
            beStopOutRate: 0,
            avgRCaptured: 0,
            avgRPotential: 0,
            rEfficiency: 0,
            tradeCount: 0,
        });
    }

    const beTriggeredTrades = trades.filter(t => t.beTriggered);
    const beProtectionRate = Math.round((beTriggeredTrades.length / tradeCount) * 1000) / 1000;

    const beStopOutCount = beTriggeredTrades.filter(t => (t.pnl ?? 0) <= 0).length;
    const beStopOutRate = beTriggeredTrades.length > 0
        ? Math.round((beStopOutCount / beTriggeredTrades.length) * 1000) / 1000
        : 0;

    const tradesWithR = trades.filter(t => t.rMultiple != null);
    const avgRCaptured = tradesWithR.length > 0
        ? Math.round((tradesWithR.reduce((sum, t) => sum + (t.rMultiple ?? 0), 0) / tradesWithR.length) * 100) / 100
        : 0;

    const tradesWithPotential = trades.filter(t =>
        t.takeProfit != null &&
        t.initialStopLoss != null &&
        t.entryPrice != null
    );
    let avgRPotential = 0;
    if (tradesWithPotential.length > 0) {
        let totalPotential = 0;
        let validCount = 0;
        for (const t of tradesWithPotential) {
            const slDist = Math.abs(t.entryPrice! - t.initialStopLoss!);
            if (slDist === 0) continue;
            const tpDist = Math.abs(t.takeProfit! - t.entryPrice!);
            totalPotential += tpDist / slDist;
            validCount++;
        }
        avgRPotential = validCount > 0
            ? Math.round((totalPotential / validCount) * 100) / 100
            : 0;
    }

    const rEfficiency = avgRPotential > 0
        ? Math.round(Math.min(avgRCaptured / avgRPotential, 1) * 1000) / 1000
        : 0;

    return ok({
        beProtectionRate,
        beStopOutRate,
        avgRCaptured,
        avgRPotential,
        rEfficiency,
        tradeCount,
    });
});

export const runtime = 'nodejs';
