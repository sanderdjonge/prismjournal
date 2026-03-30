import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import prisma from '@/lib/prisma';
import type { Session } from 'next-auth';
import { z } from 'zod';

const checklistSchema = z.object({
    setupChecklist: z.array(z.object({
        id: z.string(),
        label: z.string(),
        order: z.number(),
    })),
});

// PATCH /api/strategies/:id/checklist - Update setup checklist
export const PATCH = withAuth(async (req: NextRequest, ctx, session: Session & { user: { id: string } }) => {
    const { id } = await (ctx.params as Promise<{ id: string }>);
    const body = await req.json();
    const parsed = checklistSchema.safeParse(body);

    if (!parsed.success) {
        return NextResponse.json(
            { error: 'Invalid checklist format', details: parsed.error.errors },
            { status: 400 }
        );
    }

    // Verify strategy belongs to user
    const strategy = await prisma.strategy.findFirst({
        where: { id, userId: session.user.id },
    });

    if (!strategy) {
        return NextResponse.json({ error: 'Strategy not found' }, { status: 404 });
    }

    // Update the checklist
    const updated = await prisma.strategy.update({
        where: { id },
        data: {
            setupChecklist: parsed.data.setupChecklist,
        },
    });

    return NextResponse.json(updated);
});