import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/api/withAuth';
import type { Session } from 'next-auth';

// GET /api/strategies/[id] - Get a single strategy
export const GET = withAuth(async (
    req: NextRequest,
    _ctx: Record<string, unknown>,
    session: Session & { user: { id: string } }
) => {
    // Extract id from URL
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const id = pathParts[pathParts.length - 1];

    const strategy = await prisma.strategy.findFirst({
        where: { id, userId: session.user.id },
        include: {
            trades: {
                where: { status: 'CLOSED' },
                select: { id: true, pnl: true, exitTime: true },
                orderBy: { exitTime: 'desc' },
                take: 10,
            },
            _count: {
                select: { trades: true },
            },
        },
    });

    if (!strategy) {
        return NextResponse.json({ error: 'Strategy not found' }, { status: 404 });
    }

    return NextResponse.json(strategy);
});

export const runtime = 'nodejs';