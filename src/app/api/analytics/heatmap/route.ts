import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import { z } from 'zod';
import prisma from '@/lib/prisma';

const heatmapQuerySchema = z.object({
    accountId: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
});

export interface HeatmapCell {
    day: number; // 1=Mon, 7=Sun
    hour: number; // 0-23
    count: number;
    wins: number;
    losses: number;
    totalPnl: number;
    avgPnl: number;
    winRate: number;
}

export const GET = withAuth(async (req, _ctx, session) => {
    const { searchParams } = new URL(req.url);
    const validation = heatmapQuerySchema.safeParse({
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
        exitTime: { not: null },
        account: { userId },
    };

    if (accountId) where.accountId = accountId;
    if (from || to) {
        where.entryTime = {};
        if (from) (where.entryTime as Record<string, unknown>).gte = new Date(from);
        if (to) {
            const toDate = new Date(to);
            toDate.setDate(toDate.getDate() + 1);
            (where.entryTime as Record<string, unknown>).lt = toDate;
        }
    }

    const trades = await prisma.trade.findMany({
        where,
        select: {
            entryTime: true,
            pnl: true,
        },
    });

    // Group by day and hour
    const cellMap = new Map<string, HeatmapCell>();

    for (const trade of trades) {
        const day = trade.entryTime.getDay() || 7; // Convert Sunday (0) to 7
        const hour = trade.entryTime.getHours();
        const key = `${day}-${hour}`;

        const cell = cellMap.get(key) ?? {
            day,
            hour,
            count: 0,
            wins: 0,
            losses: 0,
            totalPnl: 0,
            avgPnl: 0,
            winRate: 0,
        };

        cell.count++;
        cell.totalPnl += trade.pnl ?? 0;
        if ((trade.pnl ?? 0) >= 0) cell.wins++;
        else cell.losses++;

        cellMap.set(key, cell);
    }

    // Calculate derived fields
    const cells = Array.from(cellMap.values()).map(cell => ({
        ...cell,
        avgPnl: cell.count > 0 ? cell.totalPnl / cell.count : 0,
        winRate: cell.count > 0 ? (cell.wins / cell.count) * 100 : 0,
    }));

    return NextResponse.json({ cells });
});

export const runtime = 'nodejs';
