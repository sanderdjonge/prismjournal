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

// PATCH /api/strategies/[id] - Update a strategy
export const PATCH = withAuth(async (
    req: NextRequest,
    _ctx: Record<string, unknown>,
    session: Session & { user: { id: string } }
) => {
    // Extract id from URL
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const id = pathParts[pathParts.length - 1];

    const body = await req.json();
    const { name, description } = body;

    // Verify ownership
    const existing = await prisma.strategy.findFirst({
        where: { id, userId: session.user.id },
    });

    if (!existing) {
        return NextResponse.json({ error: 'Strategy not found' }, { status: 404 });
    }

    const updated = await prisma.strategy.update({
        where: { id },
        data: {
            name: name ?? existing.name,
            description: description ?? existing.description,
        },
    });

    return NextResponse.json(updated);
});

// DELETE /api/strategies/[id] - Delete a strategy
export const DELETE = withAuth(async (
    req: NextRequest,
    _ctx: Record<string, unknown>,
    session: Session & { user: { id: string } }
) => {
    // Extract id from URL
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const id = pathParts[pathParts.length - 1];

    // Verify ownership
    const existing = await prisma.strategy.findFirst({
        where: { id, userId: session.user.id },
    });

    if (!existing) {
        return NextResponse.json({ error: 'Strategy not found' }, { status: 404 });
    }

    // Unlink trades from this strategy before deleting
    await prisma.trade.updateMany({
        where: { strategyId: id },
        data: { strategyId: null },
    });

    await prisma.strategy.delete({
        where: { id },
    });

    return NextResponse.json({ success: true });
});

export const runtime = 'nodejs';