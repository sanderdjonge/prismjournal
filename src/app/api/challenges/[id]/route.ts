import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import prisma from '@/lib/prisma';
import type { Session } from 'next-auth';
import { z } from 'zod';

// Validation schema for updates
const updateSchema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    rules: z.array(z.object({
        type: z.enum(['MAX_DAILY_LOSS', 'MAX_TRADES_PER_DAY', 'MIN_RR', 'TIME_WINDOW', 'MAX_DRAWDOWN', 'WIN_RATE_TARGET']),
        value: z.union([z.number(), z.string()]),
        operator: z.enum(['LT', 'LTE', 'GT', 'GTE', 'EQ']).optional(),
    })).min(1).optional(),
    isActive: z.boolean().optional(),
    endDate: z.string().nullable().optional(),
});

// GET /api/challenges/[id] - Get challenge details with evaluations
export const GET = withAuth(async (
    req: NextRequest,
    _ctx: Record<string, unknown>,
    session: Session & { user: { id: string } }
) => {
    // Extract id from URL
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const id = pathParts[pathParts.length - 1];

    const challenge = await prisma.tradingChallenge.findFirst({
        where: {
            id,
            userId: session.user.id,
        },
        include: {
            evaluations: {
                orderBy: { date: 'desc' },
                take: 30,
            },
        },
    });

    if (!challenge) {
        return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }

    // Calculate stats
    const totalDays = challenge.evaluations.length;
    const passedDays = challenge.evaluations.filter((e: { passed: boolean }) => e.passed).length;

    return NextResponse.json({
        ...challenge,
        stats: {
            totalDays,
            passedDays,
            failedDays: totalDays - passedDays,
            successRate: totalDays > 0 ? (passedDays / totalDays) * 100 : 0,
        },
    });
});

// PATCH /api/challenges/[id] - Update challenge
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
    const validated = updateSchema.safeParse(body);

    if (!validated.success) {
        return NextResponse.json(
            { error: 'Validation failed', details: validated.error.flatten() },
            { status: 400 }
        );
    }

    const challenge = await prisma.tradingChallenge.findFirst({
        where: { id, userId: session.user.id },
    });

    if (!challenge) {
        return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (validated.data.name) updateData.name = validated.data.name;
    if (validated.data.description !== undefined) updateData.description = validated.data.description;
    if (validated.data.rules) updateData.rules = validated.data.rules;
    if (validated.data.isActive !== undefined) updateData.isActive = validated.data.isActive;
    if (validated.data.endDate !== undefined) {
        updateData.endDate = validated.data.endDate ? new Date(validated.data.endDate) : null;
    }

    const updated = await prisma.tradingChallenge.update({
        where: { id },
        data: updateData,
    });

    return NextResponse.json(updated);
});

// DELETE /api/challenges/[id] - Delete challenge
export const DELETE = withAuth(async (
    req: NextRequest,
    _ctx: Record<string, unknown>,
    session: Session & { user: { id: string } }
) => {
    // Extract id from URL
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const id = pathParts[pathParts.length - 1];

    const challenge = await prisma.tradingChallenge.findFirst({
        where: { id, userId: session.user.id },
    });

    if (!challenge) {
        return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }

    await prisma.tradingChallenge.delete({
        where: { id },
    });

    return NextResponse.json({ success: true });
});