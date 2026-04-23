import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/api/withAuth';
import { ok, badRequest, notFound } from '@/lib/api/responses';
import type { Session } from 'next-auth';

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

    const strategiesWithMetrics = await Promise.all(
        strategies.map(async (strategy) => {
            const violationCount = await prisma.strategyViolation.count({
                where: { strategyId: strategy.id }
            });

            const tradesWithViolations = await prisma.strategyViolation.groupBy({
                by: ['tradeId'],
                where: { strategyId: strategy.id },
                _count: true
            });

            const totalTrades = strategy._count.trades;
            const tradesWithViolationsCount = tradesWithViolations.length;
            const adherenceScore = totalTrades > 0 
                ? Math.round(((totalTrades - tradesWithViolationsCount) / totalTrades) * 100)
                : 100;

            const violationRate = totalTrades > 0 ? violationCount / totalTrades : 0;
            const tiltmeterScore = totalTrades === 0 ? 0 : Math.min(100, Math.round(violationRate * 100));

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

    return ok({ strategies: strategiesWithMetrics });
});

export const POST = withAuth(async (
    req: NextRequest,
    _ctx: Record<string, unknown>,
    session: Session & { user: { id: string } }
) => {
    const body = await req.json();
    const { name, description, checklistId } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
        return badRequest('Strategy name is required');
    }

    const existing = await prisma.strategy.findFirst({
        where: {
            userId: session.user.id,
            name: { equals: name.trim(), mode: 'insensitive' }
        }
    });

    if (existing) {
        return badRequest('Strategy already exists');
    }

    if (checklistId) {
        const checklist = await prisma.checklist.findFirst({
            where: { id: checklistId, userId: session.user.id },
        });
        if (!checklist) {
            return notFound('Checklist');
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

    return ok({ strategy });
});

export const DELETE = withAuth(async (
    req: NextRequest,
    _ctx: Record<string, unknown>,
    session: Session & { user: { id: string } }
) => {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
        return badRequest('Strategy ID is required');
    }

    const strategy = await prisma.strategy.findFirst({
        where: { id, userId: session.user.id }
    });

    if (!strategy) {
        return notFound('Strategy');
    }

    await prisma.trade.updateMany({
        where: { strategyId: id },
        data: { strategyId: null }
    });

    await prisma.strategy.delete({ where: { id } });

    return ok({ success: true });
});

export const runtime = 'nodejs';
