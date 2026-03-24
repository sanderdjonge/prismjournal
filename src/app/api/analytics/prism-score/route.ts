import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAllUserAccounts } from '@/lib/getAccount';
import { withAuth } from '@/lib/api/withAuth';
import { computePrismScore, computeWeeklyHistory } from '@/lib/services/prism-score.service';

export const GET = withAuth(async (request: NextRequest, _ctx, session) => {
    const userId = session.user.id;
    const { searchParams } = new URL(request.url);

    const allAccounts = await getAllUserAccounts(userId);
    if (allAccounts.length === 0) {
        return NextResponse.json({ score: 0, components: {}, weeklyHistory: [] });
    }

    const accountIds = allAccounts.map(a => a.id);
    const accountFilter = searchParams.get('accountId');
    const filteredIds = accountFilter && accountIds.includes(accountFilter)
        ? [accountFilter]
        : accountIds;

    // Date range — defaults to last 90 days if not specified
    const from = searchParams.get('from');
    const to   = searchParams.get('to');

    const startDate = from ? new Date(from) : (() => {
        const d = new Date();
        d.setDate(d.getDate() - 90);
        return d;
    })();
    const endDate = to ? new Date(to) : new Date();

    const trades = await prisma.trade.findMany({
        where: {
            accountId: { in: filteredIds },
            exitTime: { gte: startDate, lte: endDate, not: null },
            pnl: { not: null },
        },
        select: { pnl: true, exitTime: true, entryTime: true },
        orderBy: { exitTime: 'asc' },
    });

    const { score, components } = computePrismScore(trades);

    // Weekly history uses all available data (not just the date range above)
    // so the trend makes sense even when the user selects a narrow window.
    const allTrades = await prisma.trade.findMany({
        where: {
            accountId: { in: filteredIds },
            exitTime: { not: null },
            pnl: { not: null },
        },
        select: { pnl: true, exitTime: true },
        orderBy: { exitTime: 'asc' },
    });

    const weeklyHistory = computeWeeklyHistory(allTrades);

    return NextResponse.json({ score, components, weeklyHistory });
});

export const runtime = 'nodejs';
