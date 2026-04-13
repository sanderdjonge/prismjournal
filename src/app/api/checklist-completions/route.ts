import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import prisma from '@/lib/prisma';
import type { Session } from 'next-auth';
import { validateBody } from '@/lib/validations/common';
import { z } from 'zod';
import { ok, badRequest, notFound } from '@/lib/api/responses';

const saveChecklistSchema = z.object({
    tradeId: z.string(),
    strategyId: z.string(),
    checklist: z.array(z.object({
        id: z.string(),
        label: z.string(),
        checked: z.boolean(),
    })),
});

export const GET = withAuth(async (
    request: NextRequest,
    _ctx: Record<string, unknown>,
    session: Session & { user: { id: string } }
) => {
    const { searchParams } = new URL(request.url);
    const tradeId = searchParams.get('tradeId');

    if (!tradeId) {
        return badRequest('tradeId required');
    }

    const trade = await prisma.trade.findFirst({
        where: {
            id: tradeId,
            account: { userId: session.user.id },
        },
        include: {
            strategy: {
                select: {
                    id: true,
                    name: true,
                    checklist: {
                        include: { items: { orderBy: { order: 'asc' } } },
                    },
                },
            },
            checklistCompletion: true,
        },
    });

    if (!trade) {
        return notFound('Trade');
    }

    if (!trade.strategy) {
        return ok({ hasStrategy: false, checklist: null });
    }

    const checklistItems = trade.strategy?.checklist?.items ?? null;

    if (!checklistItems || checklistItems.length === 0) {
        return ok({
            hasStrategy: true,
            strategyId: trade.strategy.id,
            strategyName: trade.strategy.name,
            checklist: [],
            completion: null,
        });
    }

    const completion = trade.checklistCompletion;
    const checkedState: Record<string, boolean> = {};
    
    if (completion) {
        const savedChecklist = completion.checklist as Array<{ id: string; label: string; checked: boolean }>;
        savedChecklist.forEach((item) => {
            checkedState[item.id] = item.checked;
        });
    }

    return ok({
        hasStrategy: true,
        strategyId: trade.strategy.id,
        strategyName: trade.strategy.name,
        checklist: checklistItems,
        checkedState,
        completion: completion ? {
            id: completion.id,
            totalItems: completion.totalItems,
            checkedItems: completion.checkedItems,
            completionPct: completion.completionPct,
        } : null,
    });
});

export const POST = withAuth(async (
    request: NextRequest,
    _ctx: Record<string, unknown>,
    session: Session & { user: { id: string } }
) => {
    const validation = await validateBody(request, saveChecklistSchema);
    if (!validation.success) return validation.response;
    const { tradeId, strategyId, checklist } = validation.data;

    const trade = await prisma.trade.findFirst({
        where: {
            id: tradeId,
            account: { userId: session.user.id },
        },
    });

    if (!trade) {
        return notFound('Trade');
    }

    const strategy = await prisma.strategy.findFirst({
        where: {
            id: strategyId,
            userId: session.user.id,
        },
    });

    if (!strategy) {
        return notFound('Strategy');
    }

    const totalItems = checklist.length;
    const checkedItems = checklist.filter((item) => item.checked).length;
    const completionPct = totalItems > 0 ? (checkedItems / totalItems) * 100 : 0;

    const completion = await prisma.checklistCompletion.upsert({
        where: { tradeId },
        create: {
            tradeId,
            strategyId,
            checklist,
            totalItems,
            checkedItems,
            completionPct,
        },
        update: {
            checklist,
            totalItems,
            checkedItems,
            completionPct,
        },
    });

    return ok(completion);
});
