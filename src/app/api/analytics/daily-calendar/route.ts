import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import { z } from 'zod';
import prisma from '@/lib/prisma';

const querySchema = z.object({
    accountId: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
});

export interface DailyCalendarDay {
    date: string;
    pnl: number;
    trades: number;
    wins: number;
    losses: number;
    avgRR: number | null;
}

export const GET = withAuth(async (req, _ctx, session) => {
    const { searchParams } = new URL(req.url);
    const validation = querySchema.safeParse({
        accountId: searchParams.get('accountId') ?? undefined,
        from: searchParams.get('from') ?? undefined,
        to: searchParams.get('to') ?? undefined,
    });

    if (!validation.success) {
        return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    const { accountId, from, to } = validation.data;
    const userId = session.user.id;

    const where: Record<string, unknown> = {
        account: { userId },
        exitTime: { not: null },
        pnl: { not: null },
    };

    if (accountId) where.accountId = accountId;

    if (from || to) {
        const exitTimeFilter: Record<string, unknown> = { not: null };
        if (from) exitTimeFilter.gte = new Date(from);
        if (to) {
            const toDate = new Date(to);
            toDate.setDate(toDate.getDate() + 1);
            exitTimeFilter.lt = toDate;
        }
        where.exitTime = exitTimeFilter;
    }

    const trades = await prisma.trade.findMany({
        where,
        select: {
            exitTime: true,
            pnl: true,
            rMultiple: true,
        },
    });

    const dayMap = new Map<string, { pnl: number; trades: number; wins: number; losses: number; rrSum: number; rrCount: number }>();

    for (const trade of trades) {
        if (!trade.exitTime) continue;
        const date = trade.exitTime.toISOString().slice(0, 10);
        const entry = dayMap.get(date) ?? { pnl: 0, trades: 0, wins: 0, losses: 0, rrSum: 0, rrCount: 0 };
        entry.pnl += trade.pnl ?? 0;
        entry.trades++;
        if ((trade.pnl ?? 0) >= 0) entry.wins++;
        else entry.losses++;
        if (trade.rMultiple != null) {
            entry.rrSum += trade.rMultiple;
            entry.rrCount++;
        }
        dayMap.set(date, entry);
    }

    const days: DailyCalendarDay[] = Array.from(dayMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, data]) => ({
            date,
            pnl: Math.round(data.pnl * 100) / 100,
            trades: data.trades,
            wins: data.wins,
            losses: data.losses,
            avgRR: data.rrCount > 0 ? Math.round((data.rrSum / data.rrCount) * 100) / 100 : null,
        }));

    return NextResponse.json({ days });
});

export const runtime = 'nodejs';
