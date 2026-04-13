import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import prisma from '@/lib/prisma';
import type { Session } from 'next-auth';
import { z } from 'zod';
import { ok, badRequest, notFound } from '@/lib/api/responses';

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

export const GET = withAuth(async (
    req: NextRequest,
    _ctx: Record<string, unknown>,
    session: Session & { user: { id: string } }
) => {
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
        return notFound('Challenge');
    }

    const totalDays = challenge.evaluations.length;
    const passedDays = challenge.evaluations.filter((e: { passed: boolean }) => e.passed).length;

    return ok({
        ...challenge,
        stats: {
            totalDays,
            passedDays,
            failedDays: totalDays - passedDays,
            successRate: totalDays > 0 ? (passedDays / totalDays) * 100 : 0,
        },
    });
});

export const PATCH = withAuth(async (
    req: NextRequest,
    _ctx: Record<string, unknown>,
    session: Session & { user: { id: string } }
) => {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const id = pathParts[pathParts.length - 1];

    const body = await req.json();
    const validated = updateSchema.safeParse(body);

    if (!validated.success) {
        return badRequest('Validation failed');
    }

    const challenge = await prisma.tradingChallenge.findFirst({
        where: { id, userId: session.user.id },
    });

    if (!challenge) {
        return notFound('Challenge');
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

    return ok(updated);
});

export const DELETE = withAuth(async (
    req: NextRequest,
    _ctx: Record<string, unknown>,
    session: Session & { user: { id: string } }
) => {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const id = pathParts[pathParts.length - 1];

    const challenge = await prisma.tradingChallenge.findFirst({
        where: { id, userId: session.user.id },
    });

    if (!challenge) {
        return notFound('Challenge');
    }

    await prisma.tradingChallenge.delete({
        where: { id },
    });

    return ok({ success: true });
});
