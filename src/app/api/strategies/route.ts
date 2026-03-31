import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/api/withAuth';
import type { Session } from 'next-auth';

// GET /api/strategies - List all strategies for the current user
export const GET = withAuth(async (
    _req: NextRequest,
    _ctx: Record<string, unknown>,
    session: Session & { user: { id: string } }
) => {
    const strategies = await prisma.strategy.findMany({
        where: { userId: session.user.id },
        orderBy: { name: 'asc' },
        include: {
            _count: {
                select: { trades: true }
            }
        }
    });

    // Calculate adherence and tiltmeter for each strategy
    const strategiesWithMetrics = await Promise.all(
        strategies.map(async (strategy) => {
            // Get violation count for this strategy
            const violationCount = await prisma.strategyViolation.count({
                where: { strategyId: strategy.id }
            });

            // Get unique trades that have violations for this strategy
            const tradesWithViolations = await prisma.strategyViolation.groupBy({
                by: ['tradeId'],
                where: { strategyId: strategy.id },
                _count: true
            });

            // Calculate adherence (trades without violations / total trades)
            const totalTrades = strategy._count.trades;
            const tradesWithViolationsCount = tradesWithViolations.length;
            const adherenceScore = totalTrades > 0 
                ? Math.round(((totalTrades - tradesWithViolationsCount) / totalTrades) * 100)
                : 100;

            // Simple tilt calculation based on violation count
            // Scale: 0 violations = 0, 10+ violations = 100
            const tiltmeterScore = Math.min(100, violationCount * 10);

            return {
                ...strategy,
                _count: {
                    trades: strategy._count.trades,
                    violations: violationCount
                },
                adherenceScore: Math.max(0, adherenceScore),
                tiltmeterScore
            };
        })
    );

    return NextResponse.json({ strategies: strategiesWithMetrics });
});

// POST /api/strategies - Create a new strategy
export const POST = withAuth(async (
    req: NextRequest,
    _ctx: Record<string, unknown>,
    session: Session & { user: { id: string } }
) => {
    const body = await req.json();
    const { name, description, checklistId } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
        return NextResponse.json({ error: 'Strategy name is required' }, { status: 400 });
    }

    const existing = await prisma.strategy.findFirst({
        where: {
            userId: session.user.id,
            name: { equals: name.trim(), mode: 'insensitive' }
        }
    });

    if (existing) {
        return NextResponse.json({ error: 'Strategy already exists' }, { status: 409 });
    }

    // Verify checklist ownership if provided
    if (checklistId) {
        const checklist = await prisma.checklist.findFirst({
            where: { id: checklistId, userId: session.user.id },
        });
        if (!checklist) {
            return NextResponse.json({ error: 'Checklist not found' }, { status: 404 });
        }
    }

    const strategy = await prisma.strategy.create({
        data: {
            userId: session.user.id,
            name: name.trim(),
            description: description?.trim() || null,
            checklistId: checklistId || null,
        }
    });

    return NextResponse.json({ strategy });
});

// DELETE /api/strategies - Delete a strategy
export const DELETE = withAuth(async (
    req: NextRequest,
    _ctx: Record<string, unknown>,
    session: Session & { user: { id: string } }
) => {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: 'Strategy ID is required' }, { status: 400 });
    }

    const strategy = await prisma.strategy.findFirst({
        where: { id, userId: session.user.id }
    });

    if (!strategy) {
        return NextResponse.json({ error: 'Strategy not found' }, { status: 404 });
    }

    await prisma.trade.updateMany({
        where: { strategyId: id },
        data: { strategyId: null }
    });

    await prisma.strategy.delete({ where: { id } });

    return NextResponse.json({ success: true });
});

export const runtime = 'nodejs';
