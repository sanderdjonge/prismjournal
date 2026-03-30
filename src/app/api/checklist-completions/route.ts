import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import prisma from '@/lib/prisma';
import type { Session } from 'next-auth';
import { z } from 'zod';

// Validation schema
const saveChecklistSchema = z.object({
    tradeId: z.string(),
    strategyId: z.string(),
    checklist: z.array(z.object({
        id: z.string(),
        label: z.string(),
        checked: z.boolean(),
    })),
});

// GET /api/checklist-completions - Get checklist completion for a trade
export const GET = withAuth(async (
    request: NextRequest,
    _ctx: Record<string, unknown>,
    session: Session & { user: { id: string } }
) => {
    const { searchParams } = new URL(request.url);
    const tradeId = searchParams.get('tradeId');

    if (!tradeId) {
        return NextResponse.json({ error: 'tradeId required' }, { status: 400 });
    }

    // Verify trade belongs to user
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
                    setupChecklist: true,
                },
            },
            checklistCompletion: true,
        },
    });

    if (!trade) {
        return NextResponse.json({ error: 'Trade not found' }, { status: 404 });
    }

    if (!trade.strategy) {
        return NextResponse.json({ 
            hasStrategy: false,
            checklist: null,
        });
    }

    // Parse strategy checklist items
    const checklistItems = trade.strategy.setupChecklist as Array<{ id: string; label: string; order: number }> | null;
    
    if (!checklistItems || checklistItems.length === 0) {
        return NextResponse.json({
            hasStrategy: true,
            strategyId: trade.strategy.id,
            strategyName: trade.strategy.name,
            checklist: [],
            completion: null,
        });
    }

    // Get existing completion state
    const completion = trade.checklistCompletion;
    const checkedState: Record<string, boolean> = {};
    
    if (completion) {
        const savedChecklist = completion.checklist as Array<{ id: string; label: string; checked: boolean }>;
        savedChecklist.forEach((item) => {
            checkedState[item.id] = item.checked;
        });
    }

    return NextResponse.json({
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

// POST /api/checklist-completions - Save checklist completion
export const POST = withAuth(async (
    request: NextRequest,
    _ctx: Record<string, unknown>,
    session: Session & { user: { id: string } }
) => {
    const body = await request.json();
    const parsed = saveChecklistSchema.safeParse(body);

    if (!parsed.success) {
        return NextResponse.json(
            { error: 'Invalid request body', details: parsed.error.errors },
            { status: 400 }
        );
    }

    const { tradeId, strategyId, checklist } = parsed.data;

    // Verify trade belongs to user
    const trade = await prisma.trade.findFirst({
        where: {
            id: tradeId,
            account: { userId: session.user.id },
        },
    });

    if (!trade) {
        return NextResponse.json({ error: 'Trade not found' }, { status: 404 });
    }

    // Verify strategy exists and belongs to user
    const strategy = await prisma.strategy.findFirst({
        where: {
            id: strategyId,
            userId: session.user.id,
        },
    });

    if (!strategy) {
        return NextResponse.json({ error: 'Strategy not found' }, { status: 404 });
    }

    // Calculate completion stats
    const totalItems = checklist.length;
    const checkedItems = checklist.filter((item) => item.checked).length;
    const completionPct = totalItems > 0 ? (checkedItems / totalItems) * 100 : 0;

    // Upsert completion
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

    return NextResponse.json(completion);
});